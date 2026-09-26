import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

export default function Signup() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    const name = e.target.name.value;
    const ramId = e.target.ramId.value;
    const email = e.target.email.value;
    const password = e.target.password.value;
    const role = e.target.role.value;

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered.");
      } else {
        setError("Signup failed. Try again.");
      }
    }
  };

  return (
    <form onSubmit={handleSignup}>
      <input name="name" placeholder="Name" required />
      <input name="ramId" placeholder="RAM ID" required />
      <input name="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Password" required />
      <select name="role" required>
        <option value="student">Student</option>
        <option value="faculty">Faculty</option>
      </select>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button type="submit">Sign Up</button>
    </form>
  );
}
