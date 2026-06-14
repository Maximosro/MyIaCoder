import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Note: React.StrictMode intentionally removed — double mount/unmount in dev
// triggers xterm.js disposal bugs with addons
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
