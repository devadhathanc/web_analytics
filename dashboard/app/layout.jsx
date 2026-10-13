import './globals.css';
import Navbar from '../components/Navbar';
import { ToastProvider } from '../components/Toast';

export const metadata = {
  title: 'Web Analytics — User Behavior & Heatmap Dashboard',
  description: 'Full-stack real-time user behavior analytics, session tracking, and interactive click heatmaps powered by Flask, MongoDB, and Next.js.',
  keywords: 'web analytics, heatmap, session tracking, user journey, click analytics',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <Navbar />
          {children}
          <footer className="dashboard-footer">
            <p>
              Web Analytics Platform &bull; Flask &bull; MongoDB &bull; Next.js &bull; Vanilla Tracker SDK
            </p>
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}
