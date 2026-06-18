import { Routes, Route, Link } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth.jsx'
import DrawPage from './pages/DrawPage.jsx'
import SessionDetailPage from './pages/SessionDetailPage.jsx'
import SessionsPage from './pages/SessionsPage.jsx'
import StatsPage from './pages/StatsPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import './App.css'

function NavBar() {
  const { isLoggedIn, profile, signOut, hasPermission } = useAuth()
  return (
    <header className="topbar">
      <Link to="/" className="brand">
        🎾 테니스 대진표
      </Link>
      <nav className="nav">
        {isLoggedIn ? (
          <>
            {hasPermission('draw:create') && <Link to="/">대진 추가</Link>}
            <Link to="/sessions">대진표 목록</Link>
            <Link to="/stats">통계</Link>
            {hasPermission('member:manage') && <Link to="/admin">관리자</Link>}
            <Link to="/profile" className="nav-user">{profile?.name || profile?.username || '회원'}님</Link>
            <button type="button" className="link-btn" onClick={signOut}>
              로그아웃
            </button>
          </>
        ) : (
          <>
            <Link to="/login">로그인</Link>
            <Link to="/signup">회원가입</Link>
          </>
        )}
      </nav>
    </header>
  )
}

function App() {
  return (
    <AuthProvider>
      <div className="app">
        <NavBar />
        <main>
          <Routes>
            <Route path="/" element={<DrawPage />} />
            <Route path="/draw/:id" element={<SessionDetailPage />} />
            {/* 구 링크 호환: 스코어 입력도 통합 상세 화면으로 */}
            <Route path="/session/:id/scores" element={<SessionDetailPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  )
}

export default App
