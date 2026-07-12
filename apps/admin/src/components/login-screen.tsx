import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ErrorState } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { toApiError } from "@/lib/graphql";

/** Seeded by the backend on first boot — this is a local starter, not a product. */
const DEMO_ACCOUNTS = [
  { email: "manager@example.com", label: "Compliance Manager" },
  { email: "auditor@example.com", label: "Auditor" },
  { email: "reporter@example.com", label: "Reporter" },
];

/**
 * Rendered by the root layout whenever there is no session — deliberately not a
 * route. Redirecting to a /login route meant calling navigate() during render,
 * which React rejects; gating on the session here removes the problem instead
 * of working around it.
 */
export function LoginScreen() {
  const { signIn } = useAuth();

  const [email, setEmail] = useState("manager@example.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      await signIn(email, password);
    } catch (caught) {
      setError(toApiError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="size-5" />
            <CardTitle>Compliance Triage</CardTitle>
          </div>
          <CardDescription>Sign in to continue.</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <ErrorState title="Sign in failed" message={error} />}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 space-y-2 border-t pt-4">
            <p className="text-muted-foreground text-xs">
              Seeded accounts — password <code>password123</code>
            </p>
            <div className="flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <Button
                  key={account.email}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword("password123");
                  }}
                >
                  {account.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
