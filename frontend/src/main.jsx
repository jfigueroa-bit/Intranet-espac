import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ChatUnreadProvider } from './context/ChatUnreadContext.jsx';
import { DocumentsUnreadProvider } from './context/DocumentsUnreadContext.jsx';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ChatUnreadProvider>
          <DocumentsUnreadProvider>
            <App />
          </DocumentsUnreadProvider>
        </ChatUnreadProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
