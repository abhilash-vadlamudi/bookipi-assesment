import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginForm from '../components/auth/LoginForm';
import { User } from '../services/api';

interface LoginPageProps {
  onLogin?: (user: User) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const navigate = useNavigate();

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      navigate('/');
    }
  }, [navigate]);

  const handleLoginSuccess = (token: string, user: User) => {
    if (onLogin) {
      onLogin(user);
    }
    // Navigate based on user role
    if (user.role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/');
    }
  };

  return <LoginForm onSuccess={handleLoginSuccess} />;
};

export default LoginPage;
