import net from "node:net";
import tls from "node:tls";
import { CEO_LABEL } from "./copy.mjs";

const OWNER_EMAIL = "hmlbridgham@gmail.com";

export function veilHtml(html) {
  return String(html)
    .replace(/Hanna Bridgham/gi, CEO_LABEL)
    .replace(/hanna\.bridgham@[^\s"'<>]+/gi, "")
    .replace(/hmlbridgham@gmail\.com/gi, "")
    .replace(/hanna\.bridgham/gi, "")
    .replace(/\bHanna\b/g, CEO_LABEL)
    .replace(/253[-.\s]?241[-.\s]?7270/g, "");
}

function cleanFrom(value) {
  const from = String(value || "").trim();
  if (!/^[^@\s]+@[^@\s]+$/.test(from)) return "";
  const domain = from.split("@")[1].toLowerCase();
  if (domain.endsWith(".simulation")) return "";
  if (["yapmark", "flinttable", "chartslate"].some((id) => domain.includes(id))) return "";
  return from;
}

export function mailSenderConfig() {
  const raw = String(process.env.NOTCHDAY_SMTP_URL || "").trim();
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { invalid: true };
  }
  if (url.protocol !== "smtp:" && url.protocol !== "smtps:") return { invalid: true };
  if (!url.hostname) return { invalid: true };
  const secure = url.protocol === "smtps:";
  const port = Number(url.port || (secure ? 465 : 587));
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { invalid: true };
  const user = decodeURIComponent(url.username || "");
  const pass = decodeURIComponent(url.password || "");
  const from = cleanFrom(process.env.NOTCHDAY_MAIL_FROM || user);
  if (!from) return { invalid: true };
  return { host: url.hostname, port, secure, user, pass, from };
}

export async function sendOwnerNotice({ subject, text }) {
  const config = mailSenderConfig();
  if (!config || config.invalid) return { mailed: false };
  let socket;
  try {
    socket = await openSmtp(config);
    const read = createReader(socket);
    let greeting = await command(socket, read, null);
    expectCode(greeting, [220]);
    let hello = await command(socket, read, "EHLO notchday");
    expectCode(hello, [250]);
    if (!config.secure) {
      const start = await command(socket, read, "STARTTLS");
      expectCode(start, [220]);
      socket.removeAllListeners("data");
      socket = await upgradeTls(socket, config.host);
      const secureRead = createReader(socket);
      hello = await command(socket, secureRead, "EHLO notchday");
      expectCode(hello, [250]);
      await authenticate(socket, secureRead, config);
      await deliver(socket, secureRead, config, subject, text);
    } else {
      await authenticate(socket, read, config);
      await deliver(socket, read, config, subject, text);
    }
    return { mailed: true };
  } catch (error) {
    console.error("owner notice failed");
    return { mailed: false };
  } finally {
    if (socket && !socket.destroyed) socket.end();
  }
}

function openSmtp(config) {
  return new Promise((resolve, reject) => {
    const socket = config.secure
      ? tls.connect({ host: config.host, port: config.port, servername: config.host })
      : net.connect({ host: config.host, port: config.port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("timeout"));
    }, 12000);
    const fail = (error) => {
      clearTimeout(timer);
      reject(error);
    };
    socket.once("error", fail);
    socket.once(config.secure ? "secureConnect" : "connect", () => {
      clearTimeout(timer);
      socket.off("error", fail);
      resolve(socket);
    });
  });
}

function upgradeTls(socket, host) {
  return new Promise((resolve, reject) => {
    const secure = tls.connect({ socket, servername: host });
    secure.once("secureConnect", () => resolve(secure));
    secure.once("error", reject);
  });
}

function createReader(socket) {
  let buffer = "";
  const waiters = [];
  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    drain();
  });
  socket.on("error", () => fail(new Error("smtp")));
  function fail(error) {
    while (waiters.length) {
      const waiter = waiters.shift();
      waiter.reject(error);
    }
  }
  function drain() {
    if (!waiters.length) return;
    const lines = buffer.split(/\r\n/);
    let end = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (/^\d{3} /.test(lines[i])) {
        end = i;
        break;
      }
    }
    if (end === -1) return;
    const message = lines.slice(0, end + 1).join("\n");
    buffer = lines.slice(end + 1).join("\r\n");
    const waiter = waiters.shift();
    waiter.resolve(message);
    if (buffer) drain();
  }
  return function read() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("timeout"));
      }, 12000);
      waiters.push({
        resolve: (message) => {
          clearTimeout(timer);
          resolve(message);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      drain();
    });
  };
}

function command(socket, read, line) {
  if (line !== null) socket.write(`${line}\r\n`);
  return read().then((message) => ({ code: Number(message.slice(0, 3)), message }));
}

function expectCode(reply, codes) {
  if (!codes.includes(reply.code)) throw new Error("smtp rejected");
}

async function authenticate(socket, read, config) {
  if (!config.user) return;
  const token = Buffer.from(`\0${config.user}\0${config.pass}`, "utf8").toString("base64");
  const auth = await command(socket, read, `AUTH PLAIN ${token}`);
  expectCode(auth, [235]);
}

async function deliver(socket, read, config, subject, text) {
  const from = await command(socket, read, `MAIL FROM:<${config.from}>`);
  expectCode(from, [250]);
  const to = await command(socket, read, `RCPT TO:<${OWNER_EMAIL}>`);
  expectCode(to, [250, 251]);
  const data = await command(socket, read, "DATA");
  expectCode(data, [354]);
  const body = [
    `From: ${config.from}`,
    `To: ${OWNER_EMAIL}`,
    `Subject: ${subject.replace(/[\r\n]/g, " ")}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    dotStuff(text),
  ].join("\r\n");
  socket.write(`${body}\r\n.\r\n`);
  const sent = await read();
  expectCode({ code: Number(sent.slice(0, 3)) }, [250]);
  const quit = await command(socket, read, "QUIT");
  expectCode(quit, [221]);
}

function dotStuff(text) {
  return String(text)
    .replace(/\r?\n/g, "\r\n")
    .split("\r\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}
