# 실시간 OX 퀴즈 웹앱

학생: `/`  
강사: `/admin`

## 실행

```bash
npm install
npm run dev
```

## 배포

1. GitHub에 전체 파일 업로드
2. Vercel에서 GitHub 저장소 연결
3. Vercel Environment Variables에 `.env.example`의 값을 실제 Firebase 설정값으로 입력
4. Deploy

## Firebase Realtime Database Rules 예시

관리자 비밀번호는 프론트엔드 보호용입니다. 강한 보안이 필요하면 Firebase Auth를 추가해야 합니다.

```json
{
  "rules": {
    "rooms": {
      "default": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

## 문제 붙여넣기 형식

엑셀/구글시트에서 아래처럼 복사해서 붙여넣기 가능합니다.

```text
문제	정답	해설
태양은 별이다	O	태양은 스스로 빛을 내는 별입니다.
물은 100도에서 항상 끓는다	X	기압에 따라 끓는점이 달라집니다.
```
