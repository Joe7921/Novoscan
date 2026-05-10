"""
Phase 3.6: 自定义 Agent 动态加载验证

测试场景：
  1. 向 _custom/ 目录放入一个测试 YAML → Registry 自动注册第 4 个 scoring Agent
  2. 移除后回到原始数量
  3. 验证不改代码即可扩展评分 Agent
"""

import shutil
from pathlib import Path

import pytest

from app.core.registry import BlockRegistry

APP_DIR = Path(__file__).parent.parent / "app"
CUSTOM_AGENTS_DIR = APP_DIR / "agents" / "_custom"

# 测试用自定义 Agent YAML 内容
_TEST_CUSTOM_YAML = """\
# 测试用自定义评分 Agent（仅用于测试动态加载）
id: test_custom_scorer
name: 测试自定义评分员
description: 仅用于 Phase 3.6 测试——验证 _custom Agent 自动注册
version: "1.0"
category: scoring
role_type: evaluator
notes: 测试用积木，不含真实 Prompt

inputs:
  - retrieved_context
  - analyzed_intent

outputs:
  - evaluation_result

config_schema:
  temperature:
    type: float
    default: 0.3
    min: 0
    max: 1
    description: 模型温度
"""


@pytest.fixture()
def custom_agent_yaml(tmp_path):
    """在 _custom/ 放入测试 YAML，测试结束后自动清理"""
    CUSTOM_AGENTS_DIR.mkdir(parents=True, exist_ok=True)
    yaml_path = CUSTOM_AGENTS_DIR / "test_custom_scorer.yaml"
    yaml_path.write_text(_TEST_CUSTOM_YAML, encoding="utf-8")
    yield yaml_path
    # 清理
    if yaml_path.exists():
        yaml_path.unlink()


class TestCustomAgentDynamicLoading:
    """P3.6: 自定义 Agent 动态加载验证"""

    def _count_scoring_agents(self) -> int:
        """扫描并返回 scoring 类 Agent 数量"""
        registry = BlockRegistry()
        registry.scan(APP_DIR)
        return len([a for a in registry.list_agents() if a.category == "scoring"])

    def test_baseline_scoring_count(self):
        """基线：内置 scoring Agent 数量 ≥ 3"""
        count = self._count_scoring_agents()
        assert count >= 3, f"期望至少 3 个内置 scoring Agent，实际 {count}"

    def test_custom_agent_auto_registered(self, custom_agent_yaml):
        """放入 _custom YAML 后，scoring Agent 数量应 +1"""
        baseline = self._count_scoring_agents()
        # custom_agent_yaml fixture 已写入文件，但 Registry 是全新实例需重新扫描
        # 上面 _count 每次都新建 Registry，所以这里需要确认文件已在
        assert custom_agent_yaml.exists()

        registry = BlockRegistry()
        registry.scan(APP_DIR)
        scoring = [a for a in registry.list_agents() if a.category == "scoring"]
        ids = {a.id for a in scoring}

        assert "test_custom_scorer" in ids, f"自定义 Agent 未被注册，已注册: {ids}"
        # 注意：baseline 也包含了 custom（因为 fixture 已写入），所以用绝对检查
        assert len(scoring) >= 4, f"期望至少 4 个 scoring Agent（含自定义），实际 {len(scoring)}"

    def test_custom_agent_meta_correct(self, custom_agent_yaml):
        """自定义 Agent 元数据应正确解析"""
        registry = BlockRegistry()
        registry.scan(APP_DIR)

        meta = registry.get_agent_meta("test_custom_scorer")
        assert meta is not None
        assert meta.name == "测试自定义评分员"
        assert meta.category == "scoring"
        assert "retrieved_context" in meta.inputs
        assert "evaluation_result" in meta.outputs
        assert "temperature" in meta.config_schema

    def test_removed_custom_agent_disappears(self, custom_agent_yaml):
        """删除 _custom YAML 后，该 Agent 应不再注册"""
        # 先确认存在
        registry = BlockRegistry()
        registry.scan(APP_DIR)
        assert registry.get_agent_meta("test_custom_scorer") is not None

        # 删除文件
        custom_agent_yaml.unlink()

        # 重新扫描
        registry2 = BlockRegistry()
        registry2.scan(APP_DIR)
        assert registry2.get_agent_meta("test_custom_scorer") is None, \
            "删除 YAML 后 Agent 仍被注册"
