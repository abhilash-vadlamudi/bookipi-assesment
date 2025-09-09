import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RegisterForm from '../components/auth/RegisterForm';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      navigate('/');
    }
  }, [navigate]);

  const handleRegisterSuccess = (token: string, user: any) => {
    navigate('/');
  };

  return <RegisterForm onSuccess={handleRegisterSuccess} />;
};

export default RegisterPage;
