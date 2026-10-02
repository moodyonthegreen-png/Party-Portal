import Link from "next/link";
import { BrandShell } from "@/components/BrandShell";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Host sign-in", robots: { index: false, follow: false } };

export default function HostLogin() {
  return (
    <BrandShell
      footer={
        <>
          <p className="mc-script mc-tag">Let&apos;s get this party started</p>
          <p className="mc-host">
            Looking for a party as a guest? <Link href="/">Find your party</Link>
          </p>
        </>
      }
    >
      <div className="mc-form">
        <h1 className="mc-script">Host sign-in</h1>
        <p className="mc-lead">
          Enter the email you ordered with (or the one your host invited) and we&apos;ll send you a link to your dashboard. No
          password needed.
        </p>
        <LoginForm />
      </div>
    </BrandShell>
  );
}
