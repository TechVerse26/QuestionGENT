export default function SetupScreen() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl">Firebase is not configured yet</h1>
      <p className="text-muted">EXAM MASTER needs a Firebase project. In the project folder:</p>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env</code>.</li>
        <li>Create a web app in the Firebase console (Project settings, Your apps) and paste its config values into <code className="font-mono">.env</code>.</li>
        <li>Enable Authentication (Email/Password and Google) and create a Firestore database.</li>
        <li>Deploy <code className="font-mono">firestore.rules</code> and <code className="font-mono">firestore.indexes.json</code> (see README.md).</li>
        <li>Restart the dev server: <code className="font-mono">npm run dev</code>.</li>
      </ol>
    </div>
  );
}
