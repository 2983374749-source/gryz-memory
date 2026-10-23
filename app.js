/* Demo-only frontend. Connect a real database before public deployment. */
const $ = (id) => document.getElementById(id);
const editor = $("body-editor");
const form = $("story-form");
const selectByline = $("byline");
const previewDialog = $("preview-dialog");
const safeText = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const getByline = () => selectByline.value === "penname" ? ($("penname").value.trim() || "笔名作者") : selectByline.value === "realname" ? ($("realname").value.trim() || "作者") : "匿名";
selectByline.addEventListener("change", () => {
  $("penname-wrap").classList.toggle("hidden", selectByline.value !== "penname");
  $("realname-wrap").classList.toggle("hidden", selectByline.value !== "realname");
});
document.querySelectorAll(".toolbar button").forEach(btn => btn.addEventListener("click", () => {
  editor.focus();
  const cmd = btn.dataset.cmd;
  if (cmd === "formatBlock") document.execCommand(cmd, false, btn.dataset.value);
  else document.execCommand(cmd, false, null);
}));
$("preview-btn").addEventListener("click", () => {
  const title = $("title").value.trim() || "未命名的回忆";
  $("preview-content").innerHTML = `<h1>${safeText(title)}</h1><p class="preview-byline">${safeText($("category").value)} · ${safeText(getByline())}</p><div class="preview-body">${editor.innerHTML || "<p>正文预览会显示在这里。</p>"}</div>`;
  previewDialog.showModal();
});
$("close-preview").addEventListener("click", () => previewDialog.close());
previewDialog.addEventListener("click", e => { if (e.target === previewDialog) previewDialog.close(); });
function renderStories() {
  const stories = JSON.parse(localStorage.getItem("gyyz-demo-stories") || "[]");
  const list = $("story-list");
  list.innerHTML = "";
  const q = $("search").value.trim().toLowerCase();
  const filtered = stories.filter(s => `${s.title} ${s.body} ${s.category} ${s.tags}`.toLowerCase().includes(q));
  document.querySelectorAll(".story-card").forEach(() => {});
  if (!stories.length) {
    list.innerHTML = `<article class="story-card featured"><div class="story-meta"><span>项目说明</span><span>演示版</span></div><h3>这里等待第一段真实的校园回忆</h3><p>你可以使用下方编辑器体验写作和预览。当前内容只保存在本机浏览器，尚未对外共享。</p><div class="story-footer"><span>广饶一中琐记</span><span>共创中</span></div></article>`;
  } else {
    filtered.forEach(s => {
      const card = document.createElement("article");
      card.className = "story-card";
      card.innerHTML = `<div class="story-meta"><span>${safeText(s.category)}</span><span>本机演示</span></div><h3>${safeText(s.title)}</h3><p>${safeText(s.plainBody).slice(0,160)}${s.plainBody.length>160?"…":""}</p><div class="story-footer"><span>${safeText(s.byline)}</span><span>${safeText(s.date)}</span></div>`;
      list.appendChild(card);
    });
    if (!filtered.length) list.innerHTML = `<p class="empty">没有找到相关内容。</p>`;
  }
  $("story-count").textContent = stories.length ? `${stories.length} 篇本机演示投稿` : "等待第一篇投稿";
  $("empty-state").classList.toggle("hidden", !!filtered.length || !stories.length);
}
$("search").addEventListener("input", renderStories);
form.addEventListener("submit", e => {
  e.preventDefault();
  const title = $("title").value.trim();
  const html = editor.innerHTML.trim();
  const plainBody = editor.innerText.trim();
  if (!title || !plainBody) { $("submit-message").textContent = "请填写标题和正文后再提交。"; return; }
  if (!$("consent").checked) { $("submit-message").textContent = "请先确认投稿授权与隐私说明。"; return; }
  if (selectByline.value === "penname" && !$("penname").value.trim()) { $("submit-message").textContent = "请填写笔名，或选择匿名署名。"; return; }
  if (selectByline.value === "realname" && !$("realname").value.trim()) { $("submit-message").textContent = "请填写你希望公开展示的姓名，或选择匿名/笔名。"; return; }
  const stories = JSON.parse(localStorage.getItem("gyyz-demo-stories") || "[]");
  stories.unshift({title, body:html, plainBody, category:$("category").value, byline:getByline(), tags:$("tags").value, date:new Date().toLocaleDateString("zh-CN")});
  localStorage.setItem("gyyz-demo-stories", JSON.stringify(stories));
  $("draft-status").textContent = "已保存到本机演示";
  $("submit-message").textContent = "已在此浏览器中保存并显示。注意：这不是公开发布；部署前需要接入共享数据库。";
  form.reset(); editor.innerHTML = "";
  $("penname-wrap").classList.add("hidden"); $("realname-wrap").classList.add("hidden");
  renderStories();
});
renderStories();