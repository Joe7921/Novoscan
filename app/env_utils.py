import re
from pathlib import Path
from typing import Dict, Any

def update_env_file(updates: Dict[str, Any], env_path: str = ".env"):
    """Updates the .env file with new key-value pairs."""
    path = Path(env_path)
    if not path.exists():
        path.write_text("", encoding="utf-8")

    content = path.read_text(encoding="utf-8")
    lines = content.splitlines()

    updated_keys = set()
    new_lines = []

    for line in lines:
        match = re.match(r'^([a-zA-Z_0-9]+)=(.*)$', line.strip())
        if match:
            key = match.group(1)
            if key in updates:
                new_value = updates[key]
                if new_value is None:
                    new_value = ""
                new_lines.append(f"{key}={new_value}")
                updated_keys.add(key)
                continue
        new_lines.append(line)

    for key, value in updates.items():
        if key not in updated_keys:
            if value is None:
                value = ""
            new_lines.append(f"{key}={value}")

    path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
