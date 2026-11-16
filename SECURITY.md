# 보안 정책 / Security policy

보안 취약점을 발견하셨다면 **공개 이슈 대신** 이 레포의 **Security → Report a vulnerability**(비공개 취약점 신고)로 알려 주세요. 확인 후 답변드리고, 고친 버전을 릴리스하면서 함께 안내합니다.

If you find a security issue, please **do not open a public issue**. Use **Security → Report a vulnerability** in this repository to report it privately. We will reply after checking and announce the fix with a release.

ropefit은 정적 브라우저 앱입니다. 개발 서버(`npm start`, vite)는 기본으로 localhost 에서만 열립니다. 유일한 외부 요청은 모델 ID 를 제출할 때의 `https://huggingface.co/<id>/resolve/main/config.json` 한 번이며, 토큰은 받지 않습니다. / ropefit is a static browser app. The dev server (`npm start`, vite) listens on localhost by default. The only outbound request is `https://huggingface.co/<id>/resolve/main/config.json` when you submit a model ID, and no tokens are accepted.
