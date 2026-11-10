#!/usr/bin/env python3
"""Explicit demo probe with synthetic data only; not the C summary API/DTO contract."""

import argparse
import json
import os
import time
import urllib.request


MESSAGES = [
    "민수: 이번 주에는 로그인 오류와 팀 목록 화면을 마무리합시다.",
    "지연: 팀 목록 화면은 제가 맡을게요.",
    "수아: 모바일 화면 검증은 제가 진행하겠습니다.",
    "민수: 로그인 오류를 재현했고 원인을 확인했습니다.",
    "지연: 팀 이름과 인원 표시를 먼저 확인하겠습니다.",
    "수아: 모바일에서는 작은 화면의 버튼 배치도 볼게요.",
    "민수: 팀 생성 후 워크스페이스로 돌아가는 흐름도 테스트합시다.",
    "지연: 기존 디자인의 문구와 색상은 유지하겠습니다.",
    "도윤: 기능 시연은 금요일 오후 3시가 어떨까요?",
    "수아: 동의합니다. 시연 일정은 금요일 오후 3시로 확정해요.",
    "민수: 저는 수요일 오후 5시까지 로그인 오류를 수정하겠습니다.",
    "지연: 팀 목록 화면은 목요일 정오까지 마무리할게요.",
    "수아: 모바일 검증은 목요일 오후 6시까지 끝내겠습니다.",
    "민수: 설치 실패 후 재시도하는 경우도 검증에 넣어 주세요.",
    "수아: 네, 재시도 흐름도 포함하겠습니다.",
    "도윤: 안드로이드 테스트 기기를 빌릴 수 있는지는 아직 모르겠습니다.",
    "수아: 테스트 기기 확보 여부는 목요일 아침에 확인해 주세요.",
    "지연: 시연에서는 새 팀 생성과 팀 목록 진입을 보여주겠습니다.",
    "민수: 역할과 일정은 지금 정한 내용대로 진행합시다.",
    "도윤: 아직 결정되지 않은 것은 안드로이드 테스트 기기 확보입니다.",
]

FIELDS = ('summary', 'decisions', 'action_items', 'open_questions')
SCHEMA = {
    'type': 'object',
    'properties': {
        'summary': {'type': 'string'},
        **{field: {'type': 'array', 'items': {'type': 'string'}} for field in FIELDS[1:]},
    },
    'required': list(FIELDS),
    'additionalProperties': False,
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11435"))
    parser.add_argument("--model", default=os.environ.get("OLLAMA_MODEL", "qwen3:4b"))
    parser.add_argument("--timeout", type=float, default=180)
    parser.add_argument("--runs", type=int, choices=(1, 2), default=1)
    args = parser.parse_args()
    payload = {
        "model": args.model,
        "stream": False,
        "think": False,
        "format": SCHEMA,
        "keep_alive": "5m",
        "options": {"temperature": 0, "seed": 17, "num_ctx": 2048, "num_predict": 384, "num_thread": 2},
        "messages": [
            {"role": "system", "content": "대화를 한국어 JSON으로 간결히 요약하세요. summary는 40자 이내, decisions는 확정된 결정 2개 이내, action_items는 담당자와 기한을 포함한 할 일 3개, open_questions는 미정인 사항 1개로 작성하세요. 대화에 없는 사실은 만들지 마세요."},
            {"role": "user", "content": "\n".join(MESSAGES)},
        ],
    }
    for run in range(1, args.runs + 1):
        request = urllib.request.Request(
            args.base_url.rstrip("/") + "/api/chat",
            data=json.dumps(payload, ensure_ascii=False).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        started = time.monotonic()
        with urllib.request.urlopen(request, timeout=args.timeout) as response:
            result = json.load(response)
        seconds = round(time.monotonic() - started, 2)
        if not result.get("done") or result.get("done_reason") == "length":
            raise RuntimeError("Model did not finish a complete response")
        content = json.loads(result["message"]["content"])
        if set(content) != set(FIELDS) or not isinstance(content["summary"], str):
            raise RuntimeError("Unexpected smoke-test JSON fields")
        for field in ("decisions", "action_items", "open_questions"):
            if not isinstance(content[field], list) or not all(isinstance(item, str) for item in content[field]):
                raise RuntimeError("Unexpected smoke-test JSON field type: " + field)
        text = json.dumps(content, ensure_ascii=False)
        if not any("가" <= character <= "힣" for character in text):
            raise RuntimeError("Korean output is missing")
        print(json.dumps({
            "run": run, "model": result.get("model"), "synthetic_messages": len(MESSAGES),
            "wall_seconds": seconds, "total_seconds": round(result.get("total_duration", 0) / 1e9, 2),
            "load_seconds": round(result.get("load_duration", 0) / 1e9, 2),
            "prompt_tokens": result.get("prompt_eval_count"), "output_tokens": result.get("eval_count"),
            "done_reason": result.get("done_reason"), "result": content,
        }, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
