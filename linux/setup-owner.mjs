import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { environment, database, bootstrapOwner } from "./server.mjs";
import { unassignedWorkspaces } from "./server.mjs";
const env = environment(),
  store = database(env),
  rl = createInterface({ input: stdin, output: stdout });
async function secret(prompt) {
  stdout.write(prompt);
  if (!stdin.isTTY)
    throw new Error(
      "برای ورود امن رمز، این دستور را در ترمینال تعاملی اجرا کنید.",
    );
  rl.close();
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve) => {
    let text = "";
    const data = (chunk) => {
      for (const ch of chunk.toString()) {
        if (ch === "\r" || ch === "\n") {
          stdin.off("data", data);
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write("\n");
          resolve(text);
          return;
        }
        if (ch === "\u0003") {
          stdin.setRawMode(false);
          process.exit(130);
        }
        if (ch === "\u007f") text = text.slice(0, -1);
        else if (ch >= " ") text += ch;
      }
    };
    stdin.on("data", data);
  });
}
try {
  const phone = await rl.question("شماره موبایل مالک: "),
    username = await rl.question("نام کاربری انگلیسی: "),
    cafe = await rl.question("نام کافی‌نت: ");
  const choices = await unassignedWorkspaces(store.DB);
  let cafeId;
  if (choices.length) {
    choices.forEach((x, i) =>
      console.log(
        i +
          1 +
          ". " +
          x.cafe_id +
          " (" +
          x.entries +
          " سند، " +
          x.products +
          " کالا)",
      ),
    );
    const selected = Number(
      await rl.question("شمارهٔ داده‌های متعلق به مالک، یا ۰ برای فضای خالی: "),
    );
    if (selected > 0) {
      if (!choices[selected - 1]) throw new Error("انتخاب معتبر نیست.");
      cafeId = choices[selected - 1].cafe_id;
    }
  }
  const password = await secret("رمز جدید (نمایش داده نمی‌شود): ");
  const confirmPassword = await secret("تکرار رمز: ");
  const result = await bootstrapOwner(
    store.DB,
    { phone, username, cafe, cafeId, password, confirmPassword },
    env,
  );
  console.log(
    "مالک آماده شد. کد بازیابی را امن نگه دارید: " + result.recoveryCode,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  rl.close();
  store.close();
}
