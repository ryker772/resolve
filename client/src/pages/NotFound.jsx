import { Link } from 'react-router-dom';
import { SiteHeader, SiteFooter } from '../components/ui.jsx';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="container" style={{ padding: '96px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 36, marginBottom: 12 }}>Page not found</h1>
        <p className="muted" style={{ marginBottom: 24 }}>The page you’re looking for doesn’t exist.</p>
        <Link to="/" className="btn btn-primary">Back to home</Link>
      </main>
      <SiteFooter />
    </>
  );
}
