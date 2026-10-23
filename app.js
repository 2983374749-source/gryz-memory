const SUPABASE_URL = "https://zdxusouvqwwbrdjysuqa.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_B7Xt3iQFp2xEnxJqAPZu9g_M727c1O9";
const LOCAL_STORIES_KEY = "gryz-memory-stories";
const LOCAL_COMMENTS_KEY = "gryz-memory-comments";

const $ = (id) => document.getElementById(id);

let db = null;

if (window.supabase) {
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
} else {
  console.warn("Supabase CDN 未加载，页面将使用本地缓存模式展示与保存数据。")
}

function getLocalStories() {
  try {
    const raw = localStorage.getItem(LOCAL_STORIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn("读取本地故事缓存失败。", error);
    return [];
  }
}

function setLocalStories(stories) {
  localStorage.setItem(LOCAL_STORIES_KEY, JSON.stringify(stories));
}

function getLocalComments() {
  try {
    const raw = localStorage.getItem(LOCAL_COMMENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn("读取本地评论缓存失败。", error);
    return {};
  }
}

function setLocalComments(commentsMap) {
  localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(commentsMap));
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

function clearDangerousAttributes(htmlString) {
  const tmp = document.createElement("div");
  tmp.innerHTML = htmlString || "";

  tmp.querySelectorAll("script, style, iframe, object, embed, svg, math, link, meta").forEach((node) => node.remove());

  tmp.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || name === "srcdoc") {
        node.removeAttribute(attribute.name);
      }
      if (["href", "src", "xlink:href"].includes(name) && /^(javascript:|data:|vbscript:)/i.test(attribute.value || "")) {
        node.removeAttribute(attribute.name);
      }
    });
  });

  return tmp.innerHTML;
}

function sanitizeRichText(htmlString) {
  const safe = clearDangerousAttributes(htmlString || "");
  return safe.trim();
}

function plainTextFromHtml(htmlString) {
  const tmp = document.createElement("div");
  tmp.innerHTML = sanitizeRichText(htmlString || "");
  return (tmp.textContent || "").replace(/\s+/g, " ").trim();
}

function formatDate(value) {
  if (!value) return "刚刚";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return date.toLocaleDateString("zh-CN");
}

function setSubmitMessage(message, type = "") {
  const node = $("submit-message");
  if (!node) return;
  node.textContent = message;
  node.classList.remove("success", "error");
  if (type) node.classList.add(type);
}

function setBylineVisibility() {
  const select = $("byline");
  const pennameWrap = $("penname-wrap");
  const realnameWrap = $("realname-wrap");
  if (!select || !pennameWrap || !realnameWrap) return;

  const mode = select.value;
  pennameWrap.classList.toggle("hidden", mode !== "penname");
  realnameWrap.classList.toggle("hidden", mode !== "realname");
}

function getDisplayAuthor() {
  const select = $("byline");
  if (!select) return "匿名";

  switch (select.value) {
    case "penname": return ($("penname")?.value || "").trim() || "笔名作者";
    case "realname": return ($("realname")?.value || "").trim() || "作者";
    default: return "匿名";
  }
}

function getStorySearchText(story) {
  return [
    story.title || "",
    story.plain_body || story.content || "",
    story.category || "",
    story.tags || "",
    story.author_name || ""
  ].join(" ").toLowerCase();
}

function updateStoryCount(count) {
  const mainCount = $("story-count");
  const badgeCount = $("story-count-badge");
  if (mainCount) mainCount.textContent = String(count);
  if (badgeCount) badgeCount.textContent = `${count} 篇回忆`;
}

function renderEmptyState(showHint) {
  const emptyState = $("empty-state");
  if (!emptyState) return;
  emptyState.classList.toggle("hidden", !showHint);
  if (showHint) {
    emptyState.textContent = "没有找到相关内容。试试其他关键词，或成为第一个写下这段回忆的人。";
  }
}

function buildStoryCard(story) {
  const article = document.createElement("article");
  article.className = "story-card";

  const meta = document.createElement("div");
  meta.className = "story-meta";
  const category = document.createElement("span");
  category.textContent = story.category || "其他";
  const stamp = document.createElement("span");
  stamp.textContent = "校园回忆";
  meta.append(category, stamp);

  const title = document.createElement("h3");
  title.textContent = story.title || "未命名的回忆";

  const excerpt = document.createElement("div");
  excerpt.className = "story-excerpt";
  const text = story.plain_body || story.content || "";
  excerpt.textContent = text.length > 150 ? `${text.slice(0, 150)}……` : text;

  const footer = document.createElement("div");
  footer.className = "story-footer";
  const author = document.createElement("span");
  author.textContent = story.author_name || "匿名";
  const created = document.createElement("span");
  created.textContent = formatDate(story.created_at);
  footer.append(author, created);

  const actions = document.createElement("div");
  actions.className = "story-actions";

  const readBtn = document.createElement("button");
  readBtn.type = "button";
  readBtn.className = "inline-button";
  readBtn.textContent = "详情";
  readBtn.addEventListener("click", () => openStoryDialog(story));

  const commentBtn = document.createElement("button");
  commentBtn.type = "button";
  commentBtn.className = "inline-button";
  commentBtn.textContent = "评论";
  commentBtn.addEventListener("click", () => openStoryDialog(story));

  actions.append(readBtn, commentBtn);
  article.append(meta, title, excerpt, footer, actions);
  return article;
}

async function loadCommentsForStory(storyId) {
  const commentList = $("comment-list");
  if (!commentList) return [];

  const localComments = getLocalComments();
  const fallback = localComments[String(storyId)] || [];

  if (!db) {
    renderCommentList(fallback);
    return fallback;
  }

  try {
    const { data, error } = await db
      .from("story_comments")
      .select("id, story_id, author_name, body, created_at")
      .eq("story_id", String(storyId))
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("读取评论失败，使用本地缓存。", error);
      renderCommentList(fallback);
      return fallback;
    }

    const comments = Array.isArray(data) ? data : fallback;
    const merged = [...comments, ...fallback.filter((item) => !comments.some((x) => x.body === item.body && x.author_name === item.author_name))];
    renderCommentList(merged);
    return merged;
  } catch (error) {
    console.warn("评论加载异常，已回退到本地缓存。", error);
    renderCommentList(fallback);
    return fallback;
  }
}

function renderCommentList(comments) {
  const commentList = $("comment-list");
  if (!commentList) return;

  if (!comments || !comments.length) {
    commentList.innerHTML = '<p class="empty">还没有留言，先写下第一条回声吧。</p>';
    return;
  }

  commentList.innerHTML = comments
    .map((item) => `
      <div class="comment-item">
        <strong>${escapeHtml(item.author_name || item.author || "匿名")}</strong>
        <time>${escapeHtml(formatDate(item.created_at))}</time>
        <p>${escapeHtml(item.body || "")}</p>
      </div>
    `)
    .join("");
}

async function openStoryDialog(story) {
  const dialog = $("story-dialog");
  if (!dialog || !story) return;

  $("edit-story-id").value = story.id;
  $("edit-title").value = story.title || "";
  $("edit-category").value = story.category || "其他";
  $("edit-author").value = story.author_name || "";
  $("edit-tags").value = story.tags || "";
  $("edit-body-editor").innerHTML = sanitizeRichText(story.content || story.plain_body || "");

  await loadCommentsForStory(story.id);
  dialog.showModal();
}

function persistLocalStory(story) {
  const localStories = getLocalStories();
  const nextStories = [...localStories.filter((item) => String(item.id) !== String(story.id)), story];
  nextStories.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  setLocalStories(nextStories);
}

async function saveEditedStory(event) {
  event.preventDefault();
  const id = $("edit-story-id")?.value;
  if (!id) return;

  const title = $("edit-title")?.value.trim();
  const content = sanitizeRichText($("edit-body-editor")?.innerHTML || "");
  const plainBody = plainTextFromHtml(content);
  if (!title || !plainBody) {
    setSubmitMessage("标题和正文不能为空。", "error");
    return;
  }

  const story = {
    id: Number(id),
    title,
    content,
    plain_body: plainBody,
    category: $("edit-category")?.value || "其他",
    author_name: $("edit-author")?.value.trim() || "匿名",
    tags: $("edit-tags")?.value.trim() || "",
    status: "published",
    created_at: new Date().toISOString()
  };

  persistLocalStory(story);

  if (db) {
    try {
      const { error } = await db
        .from("stories")
        .update({
          title: story.title,
          content: story.content,
          plain_body: story.plain_body,
          category: story.category,
          author_name: story.author_name,
          tags: story.tags,
          status: "published"
        })
        .eq("id", Number(id));

      if (!error) {
        setSubmitMessage("回忆已保存。", "success");
      } else {
        console.warn("数据库更新失败，已保留本地修改。", error);
        setSubmitMessage("已保存本地修改，但数据库同步失败。", "success");
      }
    } catch (error) {
      console.warn("故事编辑保存异常，已回退本地缓存。", error);
      setSubmitMessage("已保存本地修改，但数据库同步失败。", "success");
    }
  }

  await renderStories();
  $("story-dialog")?.close();
}

async function submitComment(event) {
  event.preventDefault();
  const storyId = $("edit-story-id")?.value;
  const author = $("comment-author")?.value.trim() || "匿名";
  const body = $("comment-body")?.value.trim();
  if (!storyId || !body) return;

  const entry = {
    story_id: String(storyId),
    author_name: author,
    body,
    created_at: new Date().toISOString()
  };

  const localComments = getLocalComments();
  const next = localComments[String(storyId)] || [];
  localComments[String(storyId)] = [entry, ...next];
  setLocalComments(localComments);

  if (db) {
    try {
      const { error } = await db.from("story_comments").insert({
        story_id: String(storyId),
        author_name: author,
        body,
        created_at: new Date().toISOString()
      });
      if (error) {
        console.warn("评论同步到数据库失败，已保留到本地缓存。", error);
      }
    } catch (error) {
      console.warn("评论提交异常，已保留到本地缓存。", error);
    }
  }

  $("comment-author").value = "";
  $("comment-body").value = "";
  renderCommentList(localComments[String(storyId)] || []);
}

async function renderStories() {
  const list = $("story-list");
  const query = $("search")?.value.toLowerCase().trim() || "";
  if (!list) return;

  list.innerHTML = '<p class="empty">正在加载回忆……</p>';

  let stories = [];
  if (!db) {
    stories = getLocalStories();
  } else {
    try {
      const { data, error } = await db
        .from("stories")
        .select("id,title,content,plain_body,category,author_name,created_at,tags")
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (error) throw error;
      stories = Array.isArray(data) ? data : [];
      const local = getLocalStories();
      if (local.length) {
        const map = new Map();
        stories.forEach((story) => map.set(String(story.id), story));
        local.forEach((story) => map.set(String(story.id), { ...map.get(String(story.id)), ...story }));
        stories = [...map.values()].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      }
      setLocalStories(stories);
    } catch (error) {
      console.warn("加载 Supabase 数据失败，回退到本地缓存。", error);
      stories = getLocalStories();
    }
  }

  const filtered = stories.filter((story) => !query || getStorySearchText(story).includes(query));
  list.innerHTML = "";
  if (!filtered.length) {
    updateStoryCount(stories.length);
    renderEmptyState(stories.length > 0);
    return;
  }

  filtered.forEach((story) => list.appendChild(buildStoryCard(story)));
  updateStoryCount(stories.length);
  renderEmptyState(false);
}

async function submitStory(event) {
  event.preventDefault();

  if (!db) {
    setSubmitMessage("当前页面未连接到 Supabase，无法提交。", "error");
    return;
  }

  const title = $("title")?.value.trim();
  const content = sanitizeRichText($("body-editor")?.innerHTML || "");
  const plainBody = plainTextFromHtml(content);
  const category = $("category")?.value || "其他";
  const consent = $("consent");
  const submitButton = document.querySelector("#story-form button[type='submit']");

  if (!title || !plainBody) {
    setSubmitMessage("请填写标题和正文，然后再发布。", "error");
    return;
  }
  if (!consent || !consent.checked) {
    setSubmitMessage("请确认投稿授权和隐私说明。", "error");
    return;
  }

  if (submitButton) submitButton.disabled = true;
  setSubmitMessage("正在提交……");

  try {
    const payload = {
      title,
      content,
      plain_body: plainBody,
      category,
      author_name: getDisplayAuthor(),
      tags: $("tags")?.value.trim() || "",
      status: "published",
      report_count: 0
    };

    const { data, error } = await db.from("stories").insert(payload).select();
    if (error) throw error;

    const createdStory = Array.isArray(data) && data[0] ? data[0] : null;
    if (createdStory) {
      const localStories = getLocalStories();
      const next = [createdStory, ...localStories.filter((item) => String(item.id) !== String(createdStory.id))];
      setLocalStories(next);
    }

    setSubmitMessage("投稿成功！已刷新回忆列表。", "success");
    form.reset();
    $("body-editor").innerHTML = "";
    $("draft-status").textContent = "已提交到数据库";
    await renderStories();
  } catch (error) {
    console.error("投稿失败：", error);
    setSubmitMessage(`投稿失败：${error?.message || "请检查 Supabase 设置。"}`, "error");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

function bindToolbar() {
  document.querySelectorAll(".toolbar button").forEach((button) => {
    button.addEventListener("click", () => {
      const editorNode = $("body-editor");
      if (!editorNode) return;
      editorNode.focus();
      const command = button.dataset.cmd;
      const value = button.dataset.value || null;
      if (command === "formatBlock") {
        document.execCommand(command, false, value);
      } else {
        document.execCommand(command, false, null);
      }
    });
  });
}

function openPreviewDialog() {
  const previewDialog = $("preview-dialog");
  const previewContent = $("preview-content");
  if (!previewDialog || !previewContent) return;

  const title = $("title")?.value.trim() || "未命名的回忆";
  const content = sanitizeRichText($("body-editor")?.innerHTML || "<p>正文预览</p>");
  const category = $("category")?.value || "其他";
  previewContent.innerHTML = `
    <h1>${escapeHtml(title)}</h1>
    <p class="preview-byline">${escapeHtml(category)} · ${escapeHtml(getDisplayAuthor())}</p>
    <div class="preview-body">${content}</div>
  `;
  previewDialog.showModal();
}

function init() {
  setBylineVisibility();
  bindToolbar();
  renderStories();

  $("byline")?.addEventListener("change", setBylineVisibility);
  $("search")?.addEventListener("input", renderStories);
  $("story-form")?.addEventListener("submit", submitStory);
  $("story-edit-form")?.addEventListener("submit", saveEditedStory);
  $("comment-form")?.addEventListener("submit", submitComment);
  $("preview-btn")?.addEventListener("click", openPreviewDialog);
  $("close-preview")?.addEventListener("click", () => $("preview-dialog")?.close());
  $("close-story-dialog")?.addEventListener("click", () => $("story-dialog")?.close());
  $("cancel-edit-btn")?.addEventListener("click", () => $("story-dialog")?.close());

  const previewDialog = $("preview-dialog");
  if (previewDialog) {
    previewDialog.addEventListener("click", (event) => {
      if (event.target === previewDialog) previewDialog.close();
    });
  }

  const storyDialog = $("story-dialog");
  if (storyDialog) {
    storyDialog.addEventListener("click", (event) => {
      if (event.target === storyDialog) storyDialog.close();
    });
  }
}

init();
