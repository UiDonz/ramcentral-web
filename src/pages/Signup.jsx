import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import { playAuthZoom } from '../utils/authZoom';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    ramId: '',
    email: '',
    password: '',
    role: 'student'
  });

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [zooming, setZooming] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await signup(form);
    } catch (err) {
      setError(
        err.code === 'auth/email-already-in-use'
          ? 'An account with that email already exists.'
          : 'Could not create your account. Please try again.'
      );
      setSubmitting(false);
      return;
    }
    await playAuthZoom(setZooming);
    navigate('/');
  }

  return (
    <AuthLayout zooming={zooming}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Create your account</h2>
        <p className="auth-subtitle">
          A stand-in for MyFSC login for now &mdash; see the README for notes on wiring up real SSO.
        </p>

        {error && <p className="form-error">{error}</p>}

        <div className="auth-row">
          <label>
            Full name
            <input value={form.name} onChange={update('name')} autoComplete="name" required />
          </label>

          <label>
            RAM ID
            <input value={form.ramId} onChange={update('ramId')} placeholder="R00000000" required />
          </label>
        </div>

        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={update('email')}
            placeholder="you@farmingdale.edu"
            autoComplete="email"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={update('password')}
            minLength={6}
            autoComplete="new-password"
            required
          />
        </label>

        <label>
          I am a
          <select value={form.role} onChange={update('role')}>
            <option value="student">Student</option>
            <option value="faculty">Faculty / Staff</option>
          </select>
        </label>

        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting ? 'Creating account...' : 'Create account'}
        </button>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
