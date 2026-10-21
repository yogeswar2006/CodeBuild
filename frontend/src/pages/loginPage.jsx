import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuthStore } from "../store/useAuthStore";
import toast from "react-hot-toast";
import { Code2, Eye, EyeOff, Mail, LockKeyhole, ArrowRight } from "lucide-react";
import GitBackground from "../components/GitBackground";

const fieldWrap =
  "flex items-center border-b-2 border-[#2B545C] bg-[#0D343C]/60 transition-colors focus-within:border-[#7BE5C4]";
const fieldInput =
  "w-full min-w-0 bg-transparent px-3 py-3.5 text-[15px] text-[#EAF4F1] outline-none placeholder:text-[#5F8589]";

export default function LoginPage() {
  const { login, isLoggingIn } = useAuthStore();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.email.trim() || !form.password) {
      toast.error("Please enter your email and password.");
      return;
    }

    try {
      await login({ email: form.email.trim(), password: form.password });
      toast.success("Welcome back!");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Login failed. Please try again."
      );
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden text-[#EAF4F1]">
      <GitBackground />

      <div className="relative z-10 flex min-h-screen items-center px-5 py-10 sm:px-10 lg:px-[7vw]">
        <section className="w-full max-w-[420px]">
          <Link to="/" className="mb-12 inline-flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#7BE5C4] text-[#06242A]">
              <Code2 size={22} strokeWidth={2.4} />
            </span>
            <span className="font-display text-xl font-bold tracking-tight">
              CodeSpace
            </span>
          </Link>

          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Welcome back
          </h1>
          <p className="mt-4 max-w-sm leading-7 text-[#8FB0B2]">
            Your branches, commits and open projects are right where you left
            them.
          </p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-[#CFE3E0]"
              >
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
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-[#CFE3E0]"
              >
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
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  className={fieldInput}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="mr-2 rounded p-1.5 text-[#5F8589] transition hover:text-[#7BE5C4] focus-visible:outline-2 focus-visible:outline-[#7BE5C4]"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="group flex w-full items-center justify-center gap-2 rounded-md bg-[#7BE5C4] px-5 py-3.5 text-[15px] font-semibold text-[#06242A] transition hover:bg-[#9BF0D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7BE5C4] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingIn ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#06242A]/30 border-t-[#06242A]" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </>
              )}
            </button>

            <p className="text-sm text-[#8FB0B2]">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="font-semibold text-[#F6B94A] underline-offset-4 transition hover:underline"
              >
                Create an account
              </Link>
            </p>
          </form>

          <p className="font-code mt-12 flex items-center gap-2 text-xs text-[#5F8589]">
            <span className="h-2 w-2 rounded-full bg-[#F6B94A]" />
            Not signed in
          </p>
        </section>
      </div>
    </main>
  );
}
