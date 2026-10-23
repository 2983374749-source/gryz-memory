/* 广饶一中琐记：Supabase 共享投稿 */
const SUPABASE_URL = "https://zdxusouvqwwbrdjysuqa.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_B7Xt3iQFp2xEnxJqAPZu9g_M727c1O9";

const $ = (id) => document.getElementById(id);
const editor = $("body-editor");
const form = $("story-form");
const selectByline = $("byline");
const previewDialog = $("preview-dialog");
const searchInput = $("search");
const storyList = $("story-list");
const storyCount = $("story-count");
const storyCountBadge = $("story-count-badge");
const submitMessage = $("submit-message");

let db = null;

if (window.supabase) {
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
} else {
  console.warn("Supabase 客户端未加载，页面将以静态模式展示，只能进行前端检查。请确保 CDN 脚本在 app.js 之前加载。 ");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function cleanRichText(html) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");

  doc.querySelectorAll("script,style,iframe,object,embed,form,svg,math,link,meta").forEach((el) => el.remove());

  doc.body.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = (attr.value || "").trim();

      if (name.startsWith("on") || name === "style" || name === "srcdoc") {
        el.removeAttribute(attr.name);
      }

      if (["href", "src", "xlink:href"].includes(name) && /^(javascript|data|vbscript):/i.test(value)) {
        el.removeAttribute(attr.name);
      }
    });

    if (!["P", "BR", "STRONG", "B", "EM", "I", "U", "S", "UL", "OL", "LI", "BLOCKQUOTE", "H2", "H3", "SPAN"].includes(el.tagName)) {
      el.replaceWith(...el.childNodes);
    }
  });

  return doc.body.innerHTML;
}

function plainText(html) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  return (doc.body.textContent || "").trim();
}

function getByline() {
  if (selectByline && selectByline.value === "penname") {
    return $("penname").value.trim() || "笔名作者";
  }

  if (selectByline && selectByline.value === "realname") {
    return $("realname").value.trim() || "作者";
  }

  return "匿名";
}

function setBylineVisibility() {
  const pennameWrap = $("penname-wrap");
  const realnameWrap = $("realname-wrap");

  if (!pennameWrap || !realnameWrap) return;

  const isPenname = selectByline && selectByline.value === "penname";
  const isRealname = selectByline && selectByline.value === "realname";

  pennameWrap.classList.toggle("hidden", !isPenname);
  realnameWrap.classList.toggle("hidden", !isRealname);
}

function setSubmitMessage(message, type = "") {
  if (!submitMessage) return;
  submitMessage.textContent = message;
  submitMessage.classList.remove("success", "error");
  if (type) submitMessage.classList.add(type);
}

function updateStoryCount(count) {
  if (storyCount) storyCount.textContent = String(count);
  if (storyCountBadge) storyCountBadge.textContent = `${count} 篇回忆`;
}

function showEmptyState(hasAnyStories) {
  const emptyState = $("empty-state");
  if (!emptyState || !storyList) return;

  emptyState.textContent = hasAnyStories
    ? "没有找到相关内容。试试其他关键词，或成为第一个写下这段回忆的人。"
    : "这里等待第一段真实的校园回忆。";
  emptyState.classList.remove("hidden");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("zh-CN");
}

async function renderStories() {
  if (!storyList) return;

  const keyword = (searchInput ? searchInput.value : "").trim().toLowerCase();
  storyList.innerHTML = '<p class="empty">正在加载回忆……</p>';

  if (!db) {
    storyList.innerHTML = '<p class="empty">当前无法连接数据库，暂时无法加载回忆。</p>';
    updateStoryCount(0);
    showEmptyState(false);
    return;
  }

  try {
    const { data: stories, error } = await db
      .from("stories")
      .select("id,title,content,plain_body,category,author_name,created_at,tags")
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const allStories = Array.isArray(stories) ? stories : [];
    const filteredStories = allStories.filter((story) => {
      const haystack = [
        story.title || "",
        story.plain_body || "",
        story.category || "",
        story.tags || "",
        story.author_name || ""
      ].join(" ").toLowerCase();
      return haystack.includes(keyword);
    });

    storyList.innerHTML = "";

    if (!filteredStories.length) {
      updateStoryCount(allStories.length);
      showEmptyState(allStories.length > 0);
      return;
    }

    filteredStories.forEach((story) => {
      const card = document.createElement("article");
      card.className = "story-card";

      const meta = document.createElement("div");
      meta.className = "story-meta";

      const category = document.createElement("span");
      category.textContent = story.category || "其他";

      const tag = document.createElement("span");
      tag.textContent = "校园回忆";
      meta.append(category, tag);

      const heading = document.createElement("h3");
      heading.textContent = story.title || "未命名的回忆";

      const excerpt = document.createElement("div");
      excerpt.className = "story-excerpt";
      const rawText = story.plain_body || plainText(story.content || "");
      excerpt.textContent = rawText.length > 160 ? `${rawText.slice(0, 160)}……` : rawText;

      const footer = document.createElement("div");
      footer.className = "story-footer";

      const author = document.createElement("span");
      author.textContent = story.author_name || "匿名";

      const date = document.createElement("span");
      date.textContent = formatDate(story.created_at);

      footer.append(author, date);
      card.append(meta, heading, excerpt, footer);
      storyList.appendChild(card);
    });

    updateStoryCount(allStories.length);
    const emptyState = $("empty-state");
    if (emptyState) emptyState.classList.add("hidden");
  } catch (error) {
    console.error("加载投稿失败：", error);
    storyList.innerHTML = '<p class="empty">暂时无法加载投稿，请稍后刷新页面。</p>';
    updateStoryCount(0);
    showEmptyState(false);
  }
}

if (selectByline) {
  selectByline.addEventListener("change", setBylineVisibility);
}

if (editor && document.querySelectorAll(".toolbar button").length) {
  document.querySelectorAll(".toolbar button").forEach((button) => {
    button.addEventListener("click", () => {
      editor.focus();
      const cmd = button.dataset.cmd;
      const value = button.dataset.value || null;
      if (cmd === "formatBlock") {
        document.execCommand(cmd, false, value);
      } else {
        document.execCommand(cmd, false, null);
      }
    });
  });
}

$("preview-btn")?.addEventListener("click", () => {
  const title = ($("title").value || "").trim() || "未命名的回忆";
  const previewContent = $("preview-content");
  if (!previewContent || !previewDialog) return;

  const category = $("category").value || "其他";
  const previewHtml = cleanRichText(editor.innerHTML) || "<p>正文预览会显示在这里。</p>";

  previewContent.innerHTML = `
    <h1>${escapeHtml(title)}</h1>
    <p class="preview-byline">${escapeHtml(category)} · ${escapeHtml(getByline())}</p>
    <div class="preview-body">${previewHtml}</div>
  `;

  previewDialog.showModal();
});

$("close-preview")?.addEventListener("click", () => {
  if (previewDialog) previewDialog.close();
});

previewDialog?.addEventListener("click", (event) => {
  if (event.target === previewDialog) previewDialog.close();
});

if (searchInput) {
  searchInput.addEventListener("input", renderStories);
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!db) {
    setSubmitMessage("当前页面未连接到 Supabase 数据库，无法提交。", "error");
    console.error("Supabase 客户端未初始化，无法提交投稿。");
    return;
  }

  const title = $("title").value.trim();
  const content = cleanRichText(editor.innerHTML);
  const plainBody = plainText(content);
  const category = $("category").value;
  const tags = $("tags").value.trim();

  if (!title || !plainBody) {
    setSubmitMessage("请填写标题和正文后再提交。", "error");
    return;
  }

  if (title.length > 120 || plainBody.length > 50000) {
    setSubmitMessage("标题或正文长度超出限制。", "error");
    return;
  }

  if (!$("consent").checked) {
    setSubmitMessage("请先确认投稿授权与隐私说明。", "error");
    return;
  }

  if (selectByline && selectByline.value === "penname" && !$("penname").value.trim()) {
    setSubmitMessage("请填写笔名，或选择匿名署名。", "error");
    return;
  }

  if (selectByline && selectByline.value === "realname" && !$("realname").value.trim()) {
    setSubmitMessage("请填写你希望公开展示的姓名，或选择匿名/笔名。", "error");
    return;
  }

  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = true;

  setSubmitMessage("正在提交……");

  try {
    const { error } = await db.from("stories").insert({
      title,
      content,
      plain_body: plainBody,
      category,
      author_name: getByline(),
      tags,
      status: "published",
      report_count: 0
    });

    if (error) throw error;

    setSubmitMessage("投稿成功！页面正在刷新回忆列表。", "success");

    const draftStatus = $("draft-status");
    if (draftStatus) draftStatus.textContent = "已提交到共享数据库";

    form.reset();
    if (editor) editor.innerHTML = "";
    setBylineVisibility();
    const consent = $("consent");
    if (consent) consent.checked = false;

    await renderStories();
  } catch (error) {
    console.error("提交投稿失败：", error);
    setSubmitMessage(`投稿未成功：${error?.message || "请检查数据库配置后重试。"}`, "error");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

setBylineVisibility();
renderStories();

if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.documentElement.style.scrollBehavior = "auto";
}
