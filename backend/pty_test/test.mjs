import pty from "node-pty";

const shell = pty.spawn("bash", [], { cwd: process.cwd() });
shell.onData((d) => process.stdout.write(d));
shell.write("ls\r");
shell.write("echo hello\r");
setTimeout(() => shell.kill(), 1000);