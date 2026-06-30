# 프린트 서비스 모니터링 시스템

[![English](https://img.shields.io/badge/lang-English-blue)](README.md) [![简体中文](https://img.shields.io/badge/lang-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-red)](README.zh-CN.md) [![繁體中文](https://img.shields.io/badge/lang-%E7%B9%81%E9%AB%94%E4%B8%AD%E6%96%87-red)](README.zh-TW.md) [![日本語](https://img.shields.io/badge/lang-%E6%97%A5%E6%9C%AC%E8%AA%9E-orange)](README.ja.md) [![한국어](https://img.shields.io/badge/lang-%ED%95%9C%EA%B5%AD%EC%96%B4-yellow)](README.ko.md) [![Français](https://img.shields.io/badge/lang-Fran%C3%A7ais-purple)](README.fr.md) [![Deutsch](https://img.shields.io/badge/lang-Deutsch-green)](README.de.md) [![Español](https://img.shields.io/badge/lang-Espa%C3%B1ol-orange)](README.es.md)

엔터프라이즈 프린터 장비 관리, 프린트 서버 모니터링, 자동 보고서 생성, 자산 인벤토리 추적 및 Jira 티켓 연동을 위한 모든 기능을 갖춘 셀프 호스팅 웹 애플리케이션입니다.

**React 18 + Material UI** 프론트엔드와 **Node.js + Express** 백엔드로 구축되었으며, 이중 언어 UI(English / 简体中文), 다크 모드, Windows Server 오프라인 배포를 지원합니다.

🌐 **Portal**: [http://papercut001.example-corp.com.cn:9191/](http://papercut001.example-corp.com.cn:9191/)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)
![React](https://img.shields.io/badge/react-18-blue.svg)

---

## 기능

### 🖨️ 프린터 모니터링
- **실시간 상태 모니터링** SNMP 프로토콜 기반 (토너 잔량, 용지 상태, 오류 감지)
- **30초 폴링 간격** 설정 가능한 백오프 지원
- **다중 프린터 지원** 개별 IP/SNMP 설정
- **상태 이력 추적** 일일 스냅샷
- **유지보수 모드** 특정 프린터의 모니터링 일시 중지

### 🖥️ 프린트 서버 모니터링
- **CPU, 메모리, 디스크 사용률** Windows 프린트 서버 모니터링
- **가동 시간 추적** 및 상태 이력
- **시각적 대시보드** 색상 코드 건강 상태 표시기
- **서버 구성 관리** 추가/편집/삭제 지원

### 📊 상태 대시보드
- **실시간 개요** 모든 프린터와 서버를 한 화면에서 확인
- **라이선스 관리** 만료 추적
- **인쇄 분석** 일별 사용량 차트 (기능 플래그 제어)

### 📧 자동 보고서 생성
- **정기 주간 보고서** 이메일 발송
- **5가지 보고서 스타일 템플릿** 선택 가능
- **HTML 이메일 보고서** 프린터 상태 테이블 포함
- **수신자 설정** 및 발송 일정 설정
- **수동 보고서 생성** 즉시 미리보기

### 🔔 알림 시스템
- **토너 부족 알림** 설정 가능한 임계값 (5% / 10%)
- **프린터 오프라인 알림** 이메일 통지
- **프린트 서버 오류 알림**
- **SMTP 이메일 연동** 재시도 메커니즘 포함
- **브리딩 애니메이션** 활성 알림 표시기

### 📦 자산 인벤토리
- **하드웨어 자산 추적** 및 관리
- **인벤토리 세션 관리** 정기 감사용
- **Excel 내보내기** 지원 (오프라인 사용을 위한 ExcelJS 내장)

### 🎫 Jira 티켓 연동
- **템플릿 기반 티켓 생성** 20개 이상의 설정 가능한 템플릿
- **일괄 티켓 생성** 다중 보고자 지원
- **자동 변수 입력**: `{ntid}`, `{fullname}`, `{DATE_COMPACT}` 등
- **티켓 검색** 점진적 접두사 검색 (ISDS → TPX → CHG → ECSR)
- **승인 대기 모니터링** 실시간 폴링
- **서비스 데스크 승인** 지원 (ISDS 티켓 승인/거부)
- **빠른 작업**: 댓글, 해결, 닫기 (Internal Component 자동 입력)
- **댓글 템플릿** (사용자 간 공유, 백엔드 영속화)
- **템플릿 관리** 사용 빈도 기반 정렬 및 최근 사용 추적

### 👥 사용자 관리
- **역할 기반 접근 제어**: 관리자, 편집자, 뷰어
- **JWT 인증** 리프레시 토큰 지원
- **사용자 프로필 관리**

### 🌐 국제화
- **이중 언어 UI**: 영어 및 중국어 간체
- **실시간 언어 전환** 페이지 새로고침 없이
- **모든 UI 텍스트** i18n 키로 관리

### 🌙 다크 모드
- **완전한 다크 테마 지원** 모든 컴포넌트 대응
- **CSS 변수 기반 테마 설계** 일관된 스타일링
- **원클릭 전환** 환경 설정 자동 저장

---

## 기술 스택

### 프론트엔드
| 기술 | 용도 |
|---|---|
| React 18 | UI 프레임워크 |
| Material UI 7 | 컴포넌트 라이브러리 |
| Vite 7 | 빌드 도구 및 개발 서버 |
| Chart.js | 데이터 시각화 |
| i18next | 국제화 |
| Axios | HTTP 클라이언트 |
| react-hook-form | 폼 관리 |

### 백엔드
| 기술 | 용도 |
|---|---|
| Node.js 18+ | 런타임 |
| Express 5 | 웹 프레임워크 |
| net-snmp | SNMP 프린터 조회 |
| nodemailer | 이메일 발송 |
| jsonwebtoken | JWT 인증 |
| bcryptjs | 비밀번호 해싱 |
| Puppeteer | 스크린샷 캡처 |
| Tesseract.js | OCR 처리 |
| cheerio | HTML 파싱 |

---

## 프로젝트 구조

```
├── src/                          # 프론트엔드 소스
│   ├── components/               # React 컴포넌트
│   │   ├── StatusDashboard.jsx   # 메인 모니터링 대시보드
│   │   ├── PrintServerDashboard.jsx
│   │   ├── ReportForm.jsx        # 보고서 생성
│   │   ├── AlertSettings.jsx     # 알림 설정
│   │   ├── JiraTickets.jsx       # Jira 연동
│   │   ├── AssetInventory.jsx    # 자산 추적
│   │   ├── SettingsPanel.jsx     # 시스템 설정
│   │   └── ...
│   ├── i18n/locales/             # 번역 파일
│   │   ├── en.json               # 영어
│   │   └── zh-CN.json            # 중국어 간체
│   ├── context/                  # React Context (전역 상태)
│   ├── hooks/                    # 커스텀 훅
│   ├── services/                 # 프론트엔드 서비스
│   └── theme/                    # 테마 설정
├── backend/                      # 백엔드 소스
│   ├── server.js                 # Express 서버 엔트리
│   ├── config/                   # 설정 파일 (JSON)
│   │   ├── printers.json         # 프린터 정의
│   │   ├── printServers.json     # 프린트 서버 설정
│   │   ├── alertConfig.json      # 알림 규칙
│   │   ├── jiraTemplates.json    # Jira 티켓 템플릿
│   │   └── ...
│   ├── routes/                   # API 라우트 핸들러
│   ├── services/                 # 비즈니스 로직 (16개 서비스)
│   │   ├── printerMonitoringService.js
│   │   ├── printServerMonitoringService.js
│   │   ├── scheduledReportService.js
│   │   ├── snmpService.js
│   │   ├── jiraService.js
│   │   ├── emailService.js
│   │   └── ...
│   ├── middleware/               # 인증, 검증, 포맷팅
│   └── utils/                    # JWT, 유틸리티
├── deploy/                       # 배포 스크립트
│   ├── pack-offline.sh           # 오프라인 패키지 빌더
│   ├── install-service.bat       # Windows 서비스 설치 프로그램
│   ├── frontend-server.js        # 프로덕션 정적 서버
│   └── offline-package/          # 사전 빌드 배포 패키지
└── public/                       # 정적 자산
```

---

## 시작하기

### 사전 요구 사항
- **Node.js 18+** ([다운로드](https://nodejs.org/))
- **npm** (Node.js에 포함)

### 개발 환경 설정

```bash
# 저장소 클론
git clone https://github.com/your-org/printer-status-report.git
cd printer-status-report

# 프론트엔드 의존성 설치
npm install

# 백엔드 의존성 설치
cd backend
cp .env.example .env    # 환경 변수 설정
npm install
cd ..

# 두 서비스 시작 (별도의 터미널에서)
npm run dev             # 프론트엔드: http://localhost:5175
cd backend && node server.js  # 백엔드: http://localhost:3001
```

### 환경 변수

`.env.example`에서 `backend/.env` 생성:

```env
PORT=3001
NODE_ENV=development

# SMTP 설정
SMTP_HOST=your-smtp-server
SMTP_PORT=25
SMTP_FROM=printer-monitor@yourcompany.com
ALERT_RECIPIENTS=admin@yourcompany.com

# JWT 시크릿 (미설정 시 자동 생성)
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
```

### 기본 로그인
- **사용자명**: `admin`
- **비밀번호**: `admin123` (첫 로그인 후 변경하세요)

---

## 프로덕션 배포 (Windows Server)

### 오프라인 배포

본 시스템은 **에어갭 Windows Server** 환경을 위해 설계되었습니다:

```bash
# 개발 머신에서 (macOS/Linux): 오프라인 패키지 빌드
bash deploy/pack-offline.sh
```

필요한 모든 파일이 포함된 `.zip` 파일이 생성됩니다:

1. `.zip` 파일을 Windows Server로 복사
2. 디렉토리에 압축 해제 (예: `C:\PrinterStatus`)
3. Node.js 18+가 설치되어 있는지 확인
4. `install-service.bat` 우클릭 → **관리자 권한으로 실행**
5. `http://server-ip:9191`로 접속

설치 프로그램은 **NSSM**을 사용하여 로그아웃 및 재부팅 후에도 유지되는 Windows 서비스를 등록합니다:
- `PrinterStatusBackend` (포트 3001)
- `PrinterStatusFrontend` (포트 9191)

---

## API 개요

| 메서드 | 엔드포인트 | 설명 |
|---|---|---|
| `GET` | `/api/health` | 헬스 체크 |
| `POST` | `/api/auth` | 사용자 인증 |
| `GET/POST` | `/api/printers` | 프린터 관리 |
| `GET/POST` | `/api/settings` | 시스템 설정 |
| `POST/GET` | `/api/reports` | 보고서 생성 |
| `GET/POST` | `/api/alerts` | 알림 설정 |
| `GET` | `/api/jira/templates` | Jira 티켓 템플릿 |
| `POST` | `/api/jira/tickets` | Jira 티켓 생성 |
| `GET` | `/api/jira/issues` | Jira 이슈 검색 |
| `GET` | `/api/jira/pending-approvals` | 승인 대기 티켓 |
| `POST` | `/api/jira/issues/:key/transition` | 티켓 전환 실행 |
| `GET/POST/DELETE` | `/api/jira/comment-templates` | 댓글 템플릿 |

---

## 스크린샷

> 메인 대시보드, Jira 티켓 생성, 다크 모드 등의 스크린샷을 추가하세요.

---

## 기여하기

1. 저장소를 포크
2. 기능 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 변경 사항 커밋 (`git commit -m 'Add amazing feature'`)
4. 브랜치에 푸시 (`git push origin feature/amazing-feature`)
5. Pull Request 생성

### 개발 가이드라인
- 모든 사용자 대상 텍스트는 react-i18next의 `t('key')`를 사용할 것
- `src/i18n/locales/zh-CN.json`과 `en.json` 모두에 해당 키를 추가할 것
- 기존 코드 패턴과 컴포넌트 구조를 따를 것

---

## 라이선스

이 프로젝트는 MIT 라이선스에 따라 제공됩니다 — 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

---

## 감사의 글

- [Material UI](https://mui.com/) — React 컴포넌트 라이브러리
- [Vite](https://vitejs.dev/) — 차세대 프론트엔드 도구
- [NSSM](https://nssm.cc/) — Windows 서비스 관리자
- [net-snmp](https://github.com/markabrahams/node-net-snmp) — Node.js용 SNMP 프로토콜
