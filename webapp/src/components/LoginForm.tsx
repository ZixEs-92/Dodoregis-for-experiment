"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/login/actions";

const initial: LoginState = { error: null };

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="label-text">
          ชื่อผู้ใช้
        </label>
        <input
          id="username"
          name="username"
          className="input"
          autoCapitalize="none"
          autoComplete="username"
          autoFocus
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="label-text">
          รหัสผ่าน
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete="current-password"
          required
        />
      </div>

      {state.error && (
        <p className="text-[13px] text-coral" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
