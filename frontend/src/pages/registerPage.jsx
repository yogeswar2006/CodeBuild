import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuthStore } from "../store/useAuthStore";
import toast from "react-hot-toast";
import {
  Code2,
  User,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";
import GitBackground from "../components/GitBackground";

const fieldWrap =
  "flex items-center border-b-2 border-[#2B545C] bg-[#0D343C]/60 transition-colors focus-within:border-[#7BE5C4]";
const fieldInput =
  "w-full min-w-0 bg-transparent px-3 py-3 text-[15px] text-[#EAF4F1] outline-none placeholder:text-[#5F8589]";
const labelClass = "mb-2 block text-sm font-medium text-[#CFE3E0]";

// Strength meter colours follow the branch colours used in the background.
const STRENGTH = [
  { label: "Too short", color: "#FF7F6E" },
  { label: "Weak", color: "#FF7F6E" },
  { label: "Fair", color: "#F6B94A" },
  { label: "Good", color: "#79B8FF" },
  { label: "Strong", color: "#7BE5C4" },
];

function getStrength(password) {
  if (!password) return -1;
  if (password.length < 8) return 0;
  let score = 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

export default function RegisterPage() {
  
  const { signup,isSigningUp  } = useAuthStore();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  const strength = getStrength(form.password);
  const mismatch =
    form.confirmPassword.length > 0 && form.password !== form.confirmPassword;

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.fullName.trim() || !form.email.trim() || !form.password) {
      toast.error("Please fill in all the fields.");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords don't match.");
      return;
    }

    try {
      
      await register({
        username: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      toast.success("Account created!");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Sign up failed. Please try again."
      );
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden text-[#EAF4F1]">
      <GitBackground />

      <div className="relative z-10 flex min-h-screen items-center px-5 py-10 sm:px-10 lg:px-[7vw]">
        <section className="w-full max-w-[420px]">
          <Link to="/" className="mb-10 inline-flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#7BE5C4] text-[#06242A]">
              <Code2 size={22} strokeWidth={2.4} />
            </span>
            <span className="font-display text-xl font-bold tracking-tight">
              CodeSpace
            </span>
          </Link>

          {/* Four branch colours as a short bar
          <div aria-hidden="true" className="mb-5 flex h-1 w-16 overflow-hidden rounded-full">
            <span className="flex-1 bg-[#7BE5C4]" />
            <span className="flex-1 bg-[#F6B94A]" />
            <span className="flex-1 bg-[#FF7F6E]" />
            <span className="flex-1 bg-[#79B8FF]" />
          </div> */}

          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Create your workspace
          </h1>
          <p className="mt-4 max-w-sm leading-7 text-[#8FB0B2]">
            One account for your projects, your editor and your team.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="fullName" className={labelClass}>
                Username
              </label>
              <div className={fieldWrap}>
                <User className="ml-3 shrink-0 text-[#5F8589]" size={18} />
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="name"
                  required
                  value={form.username}
                  onChange={handleChange}
                  placeholder="Ada Lovelace"
                  className={fieldInput}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className={labelClass}>
                Email address
              </label>
              <div className={fieldWrap}>
                <Mail className="ml-3 shrink-0 text-[#5F8589]" size={18} />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className={fieldInput}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className={labelClass}>
                Password
              </label>
              <div className={fieldWrap}>
                <LockKeyhole
                  className="ml-3 shrink-0 text-[#5F8589]"
                  size={18}
                />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={form.password}
                  onChange={handleChange}
                  placeholder="At least 8 characters"
                  className={fieldInput}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide passwords" : "Show passwords"}
                  aria-pressed={showPassword}
                  className="mr-2 rounded p-1.5 text-[#5F8589] transition hover:text-[#7BE5C4] focus-visible:outline-2 focus-visible:outline-[#7BE5C4]"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Strength meter */}
              {strength >= 0 && (
                <div className="mt-3 flex items-center gap-3" aria-live="polite">
                  <div className="flex flex-1 gap-1.5">
                    {[1, 2, 3, 4].map((n) => (
                      <span
                        key={n}
                        className="h-1.5 flex-1 rounded-full transition-colors"
                        style={{
                          backgroundColor:
                            strength >= n ? STRENGTH[strength].color : "#1B434B",
                        }}
                      />
                    ))}
                  </div>
                  <span className="font-code w-16 text-right text-xs text-[#8FB0B2]">
                    {STRENGTH[strength].label}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className={labelClass}>
                Confirm password
              </label>
              <div
                className={`${fieldWrap} ${
                  mismatch ? "!border-[#FF7F6E]" : ""
                }`}
              >
                <LockKeyhole
                  className="ml-3 shrink-0 text-[#5F8589]"
                  size={18}
                />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Repeat your password"
                  aria-invalid={mismatch}
                  className={fieldInput}
                />
              </div>
              {mismatch && (
                <p className="mt-1.5 text-xs text-[#FF9C8E]">
                  Passwords don't match yet.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSigningUp}
              className="group flex w-full items-center justify-center gap-2 rounded-md bg-[#7BE5C4] px-5 py-3.5 text-[15px] font-semibold text-[#06242A] transition hover:bg-[#9BF0D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7BE5C4] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSigningUp ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#06242A]/30 border-t-[#06242A]" />
                  Creating account...
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </>
              )}
            </button>

            <p className="text-sm text-[#8FB0B2]">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-[#F6B94A] underline-offset-4 transition hover:underline"
              >
                Sign in
              </Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
