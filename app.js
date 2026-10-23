```javascript
/* 广饶一中琐记：Supabase 共享投稿 */
const SUPABASE_URL = "https://zdxusouvqwwbrdjysuqa.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_B7Xt3iQFp2xEnxJqAPZu9g_M727c1O9";

const $ = (id) => document.getElementById(id);
const editor = $("body-editor");
const form = $("story-form");
const selectByline = $("byline");
const previewDialog = $("preview-dialog");

if (!window.supabase) {
  throw new Error("Supabase 客户端未加载，请检查 index.html 中的 CDN 引入。");
}

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const safeText = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

function cleanRichText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");

  doc.querySelectorAll(
    "script,style,iframe,object,embed,form,svg,math,link,meta"
  ).forEach((el) => el.remove());

  doc.body.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();

      if (
        name.startsWith("on") ||
        name === "style" ||
        name === "srcdoc"
      ) {
        el.removeAttribute(attr.name);
      }

      if (
        ["href", "src", "xlink:href"].includes(name) &&
        /^(javascript|data|vbscript):/i.test(value)
      ) {
        el.removeAttribute(attr.name);
      }
    });

    if (![
      "P", "BR", "STRONG", "B", "EM", "I", "U",
      "S", "UL", "OL", "LI", "BLOCKQUOTE", "H2", "H3"
    ].includes(el.tagName)) {
      el.replaceWith(...el.childNodes);
    }
  });

  return doc.body.innerHTML;
}

function plainText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent || "").trim();
}

function getByline() {
  if (selectByline.value === "penname") {
    return $("penname").value.trim() || "笔名作者";
  }

  if (selectByline.value === "realname") {
    return $("realname").value.trim() || "作者";
  }

  return "匿名";
}

selectByline.addEventListener("change", () => {
  $("penname-wrap").classList.toggle(
    "hidden",
    selectByline.value !== "penname"
  );

  $("realname-wrap").classList.toggle(
    "hidden",
    selectByline.value !== "realname"
  );
});

document.querySelectorAll(".toolbar button").forEach((btn) => {
  btn.addEventListener("click", () => {
    editor.focus();

    const cmd = btn.dataset.cmd;

    if (cmd === "formatBlock") {
      document.execCommand(cmd, false, btn.dataset.value);
    } else {
      document.execCommand(cmd, false, null);
    }
  });
});

$("preview-btn").addEventListener("click", () => {
  const title = $("title").value.trim() || "未命名的回忆";

  $("preview-content").innerHTML =
    `<h1>${safeText(title)}</h1>` +
    `<p class="preview-byline">${safeText($("category").value)} · ` +
    `${safeText(getByline())}</p>` +
    `<div class="preview-body">${
      cleanRichText(editor.innerHTML) ||
      "<p>正文预览会显示在这里。</p>"
    }</div>`;

  previewDialog.showModal();
});

$("close-preview").addEventListener("click", () => {
  previewDialog.close();
});

previewDialog.addEventListener("click", (e) => {
  if (e.target === previewDialog) {
    previewDialog.close();
  }
});

function formatDate(value) {
  if (!value) return "";

  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("zh-CN");
}

async function renderStories() {
  const list = $("story-list");
  const q = $("search").value.trim().toLowerCase();

  list.innerHTML = "<p>正在加载回忆……</p>";

  const { data: stories, error } = await db
    .from("stories")
    .select(
      "id,title,content,plain_body,category,author_name,created_at,tags"
    )
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    list.innerHTML =
      '<p class="empty">暂时无法加载投稿，请稍后刷新页面。</p>';

    console.error("加载投稿失败：", error);
    $("story-count").textContent = "暂时无法加载";
    return;
  }

  const allStories = stories || [];

  const filtered = allStories.filter((s) =>
    `${s.title} ${s.plain_body || ""} ${s.category} ${s.tags || ""}`
      .toLowerCase()
      .includes(q)
  );

  list.innerHTML = "";

  filtered.forEach((s) => {
    const card = document.createElement("article");
    card.className = "story-card";

    const meta = document.createElement("div");
    meta.className = "story-meta";

    const category = document.createElement("span");
    category.textContent = s.category || "其他";

    const label = document.createElement("span");
    label.textContent = "校园回忆";

    meta.append(category, label);

    const heading = document.createElement("h3");
    heading.textContent = s.title;

    const body = document.createElement("div");
    body.className = "story-excerpt";
    body.textContent = (
      s.plain_body || plainText(s.content || "")
    ).slice(0, 160);

    const footer = document.createElement("div");
    footer.className = "story-footer";

    const author = document.createElement("span");
    author.textContent = s.author_name || "匿名";

    const date = document.createElement("span");
    date.textContent = formatDate(s.created_at);

    footer.append(author, date);
    card.append(meta, heading, body, footer);
    list.appendChild(card);
  });

  if (!filtered.length) {
    list.innerHTML = `<p class="empty">${
      allStories.length
        ? "没有找到相关内容。"
        : "这里等待第一段真实的校园回忆。"
    }</p>`;
  }

  $("story-count").textContent = `${allStories.length} 篇校园回忆`;
  $("empty-state").classList.toggle("hidden", filtered.length > 0);
}

$("search").addEventListener("input", renderStories);

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = $("title").value.trim();
  const content = cleanRichText(editor.innerHTML);
  const body = plainText(content);
  const category = $("category").value;
  const tags = $("tags").value.trim();

  if (!title || !body) {
    $("submit-message").textContent = "请填写标题和正文后再提交。";
    return;
  }

  if (title.length > 120 || body.length > 50000) {
    $("submit-message").textContent = "标题或正文长度超出限制。";
    return;
  }

  if (!$("consent").checked) {
    $("submit-message").textContent = "请先确认投稿授权与隐私说明。";
    return;
  }

  if (
    selectByline.value === "penname" &&
    !$("penname").value.trim()
  ) {
    $("submit-message").textContent = "请填写笔名，或选择匿名署名。";
    return;
  }

  if (
    selectByline.value === "realname" &&
    !$("realname").value.trim()
  ) {
    $("submit-message").textContent =
      "请填写你希望公开展示的姓名，或选择匿名/笔名。";
    return;
  }

  const button = form.querySelector('[type="submit"]');

  if (button) button.disabled = true;

  $("submit-message").textContent = "正在提交……";

  try {
    const { error } = await db.from("stories").insert({
      title,
      content,
      plain_body: body,
      category,
      author_name: getByline(),
      tags,
      status: "published",
      report_count: 0
    });

    if (error) throw error;

    $("submit-message").textContent =
      "投稿成功！所有访问者都可以看到这篇回忆。";

    $("draft-status").textContent = "已提交到共享数据库";

    form.reset();
    editor.innerHTML = "";

    $("penname-wrap").classList.add("hidden");
    $("realname-wrap").classList.add("hidden");

    await renderStories();
  } catch (error) {
    console.error("提交投稿失败：", error);

    $("submit-message").textContent =
      `投稿未成功：${error.message || "请检查数据库配置后重试。"}`;
  } finally {
    if (button) button.disabled = false;
  }
});

renderStories();
```
