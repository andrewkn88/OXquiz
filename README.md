# 실시간 OX 퀴즈 웹앱

## 화면 주소

- 학생 화면: `/`
- 강사 화면: `/admin`

## 주요 기능

- 학생은 기본 링크로 입장
- 강사는 기본 링크 뒤에 `/admin`을 붙여 입장
- 방코드 없음
- 표 형식 문제 붙여넣기
- Firebase Realtime Database 실시간 동기화
- O/X 응답 실시간 확인
- 정답 공개
- 점수 자동 계산
- 효과음
- 전체 초기화

## 문제 붙여넣기 형식

엑셀 또는 구글시트에서 아래처럼 복사해서 붙여넣으세요.

```text
문제	정답	해설
지구는 둥글다	O	지구는 완전한 구는 아니지만 둥근 형태입니다.
태양은 행성이다	X	태양은 별입니다.
물은 100도에서 끓는다	O	1기압 기준입니다.
```

쉼표 형식도 어느 정도 인식합니다.

```text
문제,정답,해설
지구는 둥글다,O,지구는 둥근 형태입니다.
```

## Firebase 설정

1. Firebase 프로젝트 생성
2. Realtime Database 생성
3. Authentication > Sign-in method > Anonymous 활성화 권장
4. 프로젝트 설정에서 웹앱 추가
5. `.env.example`을 `.env`로 복사
6. Firebase 설정값 입력

## 개발 실행

```bash
npm install
npm run dev
```

## Vercel 배포

1. GitHub에 코드 업로드
2. Vercel에서 GitHub 저장소 연결
3. Environment Variables에 `.env` 값 입력
4. Deploy

## 보안 주의

현재 1차 버전은 수업용 테스트를 쉽게 하기 위해 Firebase Rules를 열어둔 형태입니다.

실제 공개 서비스에서는 반드시 보안 규칙을 강화해야 합니다.
