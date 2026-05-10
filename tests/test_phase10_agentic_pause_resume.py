import importlib
import json
import types

import pytest
from fastapi.testclient import TestClient

pytest.importorskip('langchain_core', reason='langchain_core not installed')

import app.core.agentic_runtime as runtime_module
import app.core.orchestrator as orchestrator_module
import app.main as main_module


def _parse_sse_events(payload: str) -> list[tuple[str, dict]]:
    events: list[tuple[str, dict]] = []
    for block in payload.strip().split('\n\n'):
        if not block.strip():
            continue
        event_name = 'message'
        data_payload: dict = {}
        for line in block.splitlines():
            if line.startswith('event: '):
                event_name = line[len('event: '):]
            elif line.startswith('data: '):
                data_payload = json.loads(line[len('data: '):])
        events.append((event_name, data_payload))
    return events


def _runtime_definition(*, interrupt_before: list[dict] | None = None, interrupt_after: list[dict] | None = None) -> dict:
    return {
        'dsl': {
            'interrupt_before': interrupt_before or [],
            'interrupt_after': interrupt_after or [],
            'resume_actions': [
                {'id': 'approve_and_continue', 'label': '继续执行'},
                {'id': 'revise_inputs', 'label': '修正输入后重试'},
                {'id': 'abort', 'label': '终止运行'},
            ],
        },
        'tool_policy': {
            'allowed_tools': ['search_openalex'],
        },
    }


@pytest.fixture
def client():
    runtime_module._AGENTIC_RUNS.clear()
    with TestClient(main_module.app, raise_server_exceptions=False) as test_client:
        yield test_client
    runtime_module._AGENTIC_RUNS.clear()


def _create_paused_run(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> tuple[str, list[tuple[str, dict]]]:
    monkeypatch.setattr(
        orchestrator_module,
        'get_agentic_runtime_definition',
        lambda runtime_enabled_tools=None: _runtime_definition(
            interrupt_before=[{'target': 'workflow.entry', 'reason': 'test pause'}],
        ),
    )
    response = client.post(
        '/api/v1/analyze/agentic/stream',
        json={'user_raw_input': '测试输入', 'detection_type': 'auto'},
    )
    assert response.status_code == 200
    assert 'text/event-stream' in response.headers.get('content-type', '')
    events = _parse_sse_events(response.text)
    assert [name for name, _ in events] == ['stream_start', 'hitl_interrupt', 'stream_end']
    interrupt_payload = events[1][1]
    assert interrupt_payload['pause_target'] == 'workflow.entry'
    assert interrupt_payload['runtime_state']['status'] == 'paused'
    thread_id = interrupt_payload['thread_id']
    runtime_response = client.get(f'/api/v1/agentic/thread/{thread_id}')
    assert runtime_response.status_code == 200
    runtime_data = runtime_response.json()
    assert runtime_data['status'] == 'paused'
    assert runtime_data['pause_target'] == 'workflow.entry'
    return thread_id, events


def _create_after_execution_paused_run(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    *,
    expected_score: int = 92,
) -> tuple[str, list[tuple[str, dict]]]:
    monkeypatch.setattr(
        orchestrator_module,
        'get_agentic_runtime_definition',
        lambda runtime_enabled_tools=None: _runtime_definition(
            interrupt_after=[{'target': 'workflow.complete', 'reason': 'test after execution pause'}],
        ),
    )

    class FakeGraph:
        async def astream_events(self, *_args, **_kwargs):
            if False:
                yield {}

        def get_state(self, _config):
            return types.SimpleNamespace(values={'messages': [types.SimpleNamespace(content='after execution output')]})

    async def fake_compile_agentic_report(messages: list[object]) -> tuple[dict, int]:
        assert messages[-1].content == 'after execution output'
        return {'report': {'meta': {'overallScore': expected_score}}}, expected_score

    monkeypatch.setattr(orchestrator_module, 'build_agentic_graph', lambda **_kwargs: FakeGraph())
    monkeypatch.setattr(main_module, '_compile_agentic_report', fake_compile_agentic_report)
    monkeypatch.setattr(main_module, '_save_agentic_run_snapshot', lambda *args, **kwargs: None)

    response = client.post(
        '/api/v1/analyze/agentic/stream',
        json={'user_raw_input': 'after execution 测试输入', 'detection_type': 'auto'},
    )
    assert response.status_code == 200
    assert 'text/event-stream' in response.headers.get('content-type', '')
    events = _parse_sse_events(response.text)
    assert [name for name, _ in events] == ['stream_start', 'report_compiling', 'hitl_interrupt', 'stream_end']

    interrupt_payload = events[2][1]
    assert interrupt_payload['pause_target'] == 'workflow.complete'
    assert interrupt_payload['pending_result']['final_score'] == expected_score
    assert interrupt_payload['pending_result']['tool_calls_count'] == 0
    assert interrupt_payload['runtime_state']['status'] == 'paused'
    assert interrupt_payload['runtime_state']['pause_phase'] == 'after_execution'

    thread_id = interrupt_payload['thread_id']
    runtime_response = client.get(f'/api/v1/agentic/thread/{thread_id}')
    assert runtime_response.status_code == 200
    runtime_data = runtime_response.json()
    assert runtime_data['status'] == 'paused'
    assert runtime_data['pause_target'] == 'workflow.complete'
    assert runtime_data['pause_phase'] == 'after_execution'

    run_state = runtime_module.get_agentic_run(thread_id)
    assert run_state is not None
    assert run_state['final_payload'] is not None
    assert run_state['final_payload']['status'] == 'completed'
    assert run_state['final_payload']['final_score'] == expected_score
    return thread_id, events


def test_agentic_stream_interrupt_before_pauses(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    thread_id, events = _create_paused_run(client, monkeypatch)
    assert events[0][1]['thread_id'] == thread_id


def test_agentic_stream_interrupt_after_pauses_with_pending_result(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    thread_id, events = _create_after_execution_paused_run(client, monkeypatch, expected_score=92)
    assert events[0][1]['thread_id'] == thread_id


@pytest.mark.parametrize(
    ('action', 'payload', 'expected_status', 'expected_score'),
    [
        ('approve_and_continue', {}, 'completed', 88),
        ('revise_inputs', {'feedback': '请聚焦医疗场景', 'revised_user_input': '新的医疗输入'}, 'completed', 91),
    ],
)
def test_agentic_resume_actions_complete_run(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    action: str,
    payload: dict,
    expected_status: str,
    expected_score: int,
):
    thread_id, _ = _create_paused_run(client, monkeypatch)

    monkeypatch.setattr(
        orchestrator_module,
        'get_agentic_runtime_definition',
        lambda runtime_enabled_tools=None: _runtime_definition(),
    )

    async def fake_execute_agentic_once(thread_id_arg: str, request_payload: dict, runtime_definition: dict) -> dict:
        assert thread_id_arg == thread_id
        assert runtime_definition['tool_policy']['allowed_tools'] == ['search_openalex']
        return {
            'thread_id': thread_id_arg,
            'mode': 'agentic',
            'status': 'completed',
            'final_output': f'{action} done',
            'tool_calls_count': 1,
            'tool_calls': [{'tool': 'search_openalex', 'status': 'completed'}],
            'message_count': 1,
            'report_json': {'report': {'meta': {'overallScore': expected_score}}},
            'final_score': expected_score,
        }

    monkeypatch.setattr(main_module, '_execute_agentic_once', fake_execute_agentic_once)

    response = client.post(
        f'/api/v1/agentic/thread/{thread_id}/resume/stream',
        json={'action': action, **payload},
    )
    assert response.status_code == 200
    events = _parse_sse_events(response.text)
    assert [name for name, _ in events] == ['resume_start', 'stream_complete', 'stream_end']
    assert events[0][1]['action'] == action
    assert events[1][1]['status'] == expected_status
    assert events[1][1]['runtime_state']['status'] == expected_status
    assert events[1][1]['final_score'] == expected_score

    runtime_response = client.get(f'/api/v1/agentic/thread/{thread_id}')
    assert runtime_response.status_code == 200
    runtime_data = runtime_response.json()
    assert runtime_data['status'] == expected_status

    run_state = runtime_module.get_agentic_run(thread_id)
    assert run_state is not None
    if action == 'revise_inputs':
        assert run_state['request']['user_raw_input'] == payload['revised_user_input']
        assert run_state['request']['extra_instructions'] == payload['feedback']


def test_agentic_after_execution_approve_and_continue_completes_without_rerun(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    thread_id, _ = _create_after_execution_paused_run(client, monkeypatch, expected_score=92)
    execute_called = False

    async def fake_execute_agentic_once(*_args, **_kwargs) -> dict:
        nonlocal execute_called
        execute_called = True
        raise AssertionError('approve_and_continue after after_execution should not re-run _execute_agentic_once')

    monkeypatch.setattr(main_module, '_execute_agentic_once', fake_execute_agentic_once)

    response = client.post(
        f'/api/v1/agentic/thread/{thread_id}/resume/stream',
        json={'action': 'approve_and_continue'},
    )
    assert response.status_code == 200
    events = _parse_sse_events(response.text)
    assert [name for name, _ in events] == ['resume_start', 'stream_complete', 'stream_end']
    assert events[1][1]['status'] == 'completed'
    assert events[1][1]['runtime_state']['status'] == 'completed'
    assert events[1][1]['final_score'] == 92
    assert execute_called is False

    runtime_response = client.get(f'/api/v1/agentic/thread/{thread_id}')
    assert runtime_response.status_code == 200
    runtime_data = runtime_response.json()
    assert runtime_data['status'] == 'completed'


def test_agentic_after_execution_revise_inputs_reruns_and_updates_request(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    thread_id, _ = _create_after_execution_paused_run(client, monkeypatch, expected_score=83)

    monkeypatch.setattr(
        orchestrator_module,
        'get_agentic_runtime_definition',
        lambda runtime_enabled_tools=None: _runtime_definition(),
    )

    async def fake_execute_agentic_once(thread_id_arg: str, request_payload: dict, runtime_definition: dict) -> dict:
        assert thread_id_arg == thread_id
        assert request_payload['user_raw_input'] == 'after execution 修正输入'
        assert request_payload['extra_instructions'] == '请重新聚焦 after execution'
        assert runtime_definition['tool_policy']['allowed_tools'] == ['search_openalex']
        return {
            'thread_id': thread_id_arg,
            'mode': 'agentic',
            'status': 'completed',
            'final_output': 'after execution revise done',
            'tool_calls_count': 1,
            'tool_calls': [{'tool': 'search_openalex', 'status': 'completed'}],
            'message_count': 1,
            'report_json': {'report': {'meta': {'overallScore': 95}}},
            'final_score': 95,
        }

    monkeypatch.setattr(main_module, '_execute_agentic_once', fake_execute_agentic_once)

    response = client.post(
        f'/api/v1/agentic/thread/{thread_id}/resume/stream',
        json={
            'action': 'revise_inputs',
            'feedback': '请重新聚焦 after execution',
            'revised_user_input': 'after execution 修正输入',
        },
    )
    assert response.status_code == 200
    events = _parse_sse_events(response.text)
    assert [name for name, _ in events] == ['resume_start', 'stream_complete', 'stream_end']
    assert events[1][1]['status'] == 'completed'
    assert events[1][1]['runtime_state']['status'] == 'completed'
    assert events[1][1]['final_score'] == 95

    runtime_response = client.get(f'/api/v1/agentic/thread/{thread_id}')
    assert runtime_response.status_code == 200
    runtime_data = runtime_response.json()
    assert runtime_data['status'] == 'completed'

    run_state = runtime_module.get_agentic_run(thread_id)
    assert run_state is not None
    assert run_state['request']['user_raw_input'] == 'after execution 修正输入'
    assert run_state['request']['extra_instructions'] == '请重新聚焦 after execution'


def test_agentic_abort_action_marks_runtime_aborted(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    thread_id, _ = _create_paused_run(client, monkeypatch)

    response = client.post(
        f'/api/v1/agentic/thread/{thread_id}/resume/stream',
        json={'action': 'abort', 'feedback': '用户取消'},
    )
    assert response.status_code == 200
    events = _parse_sse_events(response.text)
    assert [name for name, _ in events] == ['resume_start', 'stream_complete', 'stream_end']
    assert events[1][1]['status'] == 'aborted'
    assert events[1][1]['runtime_state']['status'] == 'aborted'
    assert events[1][1]['runtime_state']['error'] == '用户取消'

    runtime_response = client.get(f'/api/v1/agentic/thread/{thread_id}')
    assert runtime_response.status_code == 200
    runtime_data = runtime_response.json()
    assert runtime_data['status'] == 'aborted'
    assert runtime_data['error'] == '用户取消'


def test_agentic_after_execution_abort_marks_runtime_aborted(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    thread_id, _ = _create_after_execution_paused_run(client, monkeypatch, expected_score=84)

    response = client.post(
        f'/api/v1/agentic/thread/{thread_id}/resume/stream',
        json={'action': 'abort', 'feedback': 'after execution 用户取消'},
    )
    assert response.status_code == 200
    events = _parse_sse_events(response.text)
    assert [name for name, _ in events] == ['resume_start', 'stream_complete', 'stream_end']
    assert events[1][1]['status'] == 'aborted'
    assert events[1][1]['runtime_state']['status'] == 'aborted'
    assert events[1][1]['runtime_state']['error'] == 'after execution 用户取消'

    runtime_response = client.get(f'/api/v1/agentic/thread/{thread_id}')
    assert runtime_response.status_code == 200
    runtime_data = runtime_response.json()
    assert runtime_data['status'] == 'aborted'
    assert runtime_data['error'] == 'after execution 用户取消'
