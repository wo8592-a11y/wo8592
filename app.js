/**
 * 정보채널 커뮤니티 애플리케이션 스크립트
 * - 관리자 권한 및 채널(탭) 커스텀 관리 시스템
 * - 전체 통합 탭 및 채널별 필터링
 * - 사진(이미지) 및 동영상(비디오) 로컬 직접 업로드 지원
 * - 20개 단위 페이지네이션
 */

class InfoChannelApp {
  constructor() {
    this.PAGE_SIZE = 20;

    // 채널 기본 설정 (관리자가 자유롭게 수정/추가/삭제 가능)
    this.defaultCategories = [
      { id: "general", name: "일반", icon: "fa-regular fa-comments" },
      { id: "info", name: "정보", icon: "fa-solid fa-desktop" },
      { id: "chat", name: "잡담", icon: "fa-solid fa-mug-hot" }
    ];

    // 채널 기본 메타 정보
    this.defaultMeta = {
      name: "정보채널",
      desc: "유용한 IT 정보, 꿀팁, 일상 잡담을 자유롭게 나누는 소통 공간입니다.",
      icon: "fa-solid fa-database"
    };

    // 상태값
    this.posts = [];
    this.categories = [];
    this.channelMeta = { ...this.defaultMeta };
    this.currentCategory = "all"; // 기본값: 전체 통합 탭
    this.currentPage = 1;
    this.currentSort = "newest";
    this.searchQuery = "";
    this.currentPostId = null;
    this.isAdmin = false;
    this.uploadedMedia = null; // { type: 'image' | 'video', url: '', name: '' }

    this.init();
  }

  init() {
    // 1. 관리자 세션 로드
    this.isAdmin = localStorage.getItem("info_channel_admin") === "true";

    // 2. 채널 및 메타 설정 로드
    this.loadChannelSettings();

    // 3. 기존 글 데이터 정리 및 로드 (초기화)
    this.loadPosts();

    // 4. UI 및 탭 렌더링
    this.updateAdminUI();
    this.renderTabs();
    this.renderChannelMetaUI();
    this.renderWriteCategoryOptions();
    this.render();

    // 5. URL 해시 라우팅 지원
    window.addEventListener("hashchange", () => this.handleHashRoute());
    this.handleHashRoute();
  }

  // ==========================================
  // 관리자 보안 코드 관리
  // ==========================================
  getAdminCode() {
    return localStorage.getItem("info_channel_admin_code") || "1199";
  }

  setAdminCode(newCode) {
    localStorage.setItem("info_channel_admin_code", newCode);
  }

  // ==========================================
  // 채널(카테고리) 및 메타 정보 로드 & 저장
  // ==========================================
  loadChannelSettings() {
    // 채널 탭 목록 로드
    const savedCats = localStorage.getItem("info_channel_categories");
    if (savedCats) {
      try {
        this.categories = JSON.parse(savedCats);
      } catch (e) {
        this.categories = [...this.defaultCategories];
      }
    } else {
      this.categories = [...this.defaultCategories];
      this.saveCategories();
    }

    // 채널 기본 정보 로드
    const savedMeta = localStorage.getItem("info_channel_meta");
    if (savedMeta) {
      try {
        this.channelMeta = JSON.parse(savedMeta);
      } catch (e) {
        this.channelMeta = { ...this.defaultMeta };
      }
    } else {
      this.channelMeta = { ...this.defaultMeta };
      this.saveChannelMetaStorage();
    }
  }

  saveCategories() {
    localStorage.setItem("info_channel_categories", JSON.stringify(this.categories));
  }

  saveChannelMetaStorage() {
    localStorage.setItem("info_channel_meta", JSON.stringify(this.channelMeta));
  }

  renderChannelMetaUI() {
    const titleEl = document.getElementById("pageTitle");
    const nameEl = document.getElementById("channelNameDisplay");
    const descEl = document.getElementById("channelDescDisplay");
    const avatarEl = document.getElementById("channelAvatarIcon");
    const brandTextEl = document.getElementById("brandLogoText");
    const brandIconEl = document.getElementById("brandLogoIcon");

    if (titleEl) titleEl.textContent = `${this.channelMeta.name} - 커뮤니티`;
    if (nameEl) nameEl.textContent = this.channelMeta.name;
    if (descEl) descEl.textContent = this.channelMeta.desc;
    if (avatarEl) avatarEl.innerHTML = `<i class="${this.channelMeta.icon}"></i>`;
    if (brandTextEl) brandTextEl.textContent = this.channelMeta.name;
    if (brandIconEl) brandIconEl.innerHTML = `<i class="${this.channelMeta.icon}"></i>`;

    // 채널 관리 폼 필드에도 채우기
    const setChannelName = document.getElementById("settingChannelName");
    const setChannelIcon = document.getElementById("settingChannelIcon");
    const setChannelDesc = document.getElementById("settingChannelDesc");
    if (setChannelName) setChannelName.value = this.channelMeta.name;
    if (setChannelIcon) setChannelIcon.value = this.channelMeta.icon;
    if (setChannelDesc) setChannelDesc.value = this.channelMeta.desc;
  }

  // ==========================================
  // 데이터 스토리지 (기존 글 완전 초기화 적용)
  // ==========================================
  loadPosts() {
    // 기존 더미 데이터 정리 플래그 확인
    const clearedFlag = localStorage.getItem("info_channel_cleared_v2");
    if (!clearedFlag) {
      // 기존 저장된 더미 글들을 싹 지워줌
      this.posts = [];
      this.savePosts();
      localStorage.setItem("info_channel_cleared_v2", "true");
      return;
    }

    const saved = localStorage.getItem("info_channel_posts");
    if (saved) {
      try {
        this.posts = JSON.parse(saved);
      } catch (e) {
        this.posts = [];
      }
    } else {
      this.posts = [];
      this.savePosts();
    }
  }

  savePosts() {
    localStorage.setItem("info_channel_posts", JSON.stringify(this.posts));
  }

  refreshBoard() {
    this.loadPosts();
    this.render();
    this.showToast("게시판 목록을 새로고침했습니다.", "info");
  }

  // ==========================================
  // 네비게이션 탭 렌더링 ('전체' 탭 + 커스텀 채널 탭)
  // ==========================================
  renderTabs() {
    const container = document.getElementById("categoryTabList");
    if (!container) return;

    let html = `
      <!-- 전체 탭 (모든 채널 통합) -->
      <button class="tab-item ${this.currentCategory === 'all' ? 'active' : ''}" data-category="all" onclick="app.selectTab('all')">
        <i class="fa-solid fa-list-ul tab-icon"></i>
        <span class="tab-label">전체</span>
      </button>
    `;

    // 각 카테고리 탭 렌더링
    this.categories.forEach(cat => {
      const activeClass = this.currentCategory === cat.id ? "active" : "";
      html += `
        <button class="tab-item ${activeClass}" data-category="${cat.id}" onclick="app.selectTab('${cat.id}')">
          <i class="${cat.icon} tab-icon"></i>
          <span class="tab-label">${this.escapeHtml(cat.name)}</span>
        </button>
      `;
    });

    container.innerHTML = html;
  }

  renderWriteCategoryOptions() {
    const container = document.getElementById("writeCategoryRadioGroup");
    if (!container) return;

    if (this.categories.length === 0) {
      container.innerHTML = `<span style="color: var(--text-muted); font-size: 13px;">등록된 채널이 없습니다. 관리자에게 문의하세요.</span>`;
      return;
    }

    let html = "";
    this.categories.forEach((cat, index) => {
      const checked = (this.currentCategory === cat.id || (this.currentCategory === "all" && index === 0)) ? "checked" : "";
      html += `
        <label class="category-radio-btn">
          <input type="radio" name="writeCategory" value="${cat.id}" ${checked}>
          <span class="radio-custom">
            <i class="${cat.icon}"></i> ${this.escapeHtml(cat.name)}
          </span>
        </label>
      `;
    });

    container.innerHTML = html;
  }

  selectTab(category) {
    this.currentCategory = category;
    this.currentPage = 1;
    this.renderTabs();
    this.render();
  }

  navigateHome(e) {
    if (e) e.preventDefault();
    this.currentPostId = null;
    window.location.hash = "";
    document.getElementById("listView").style.display = "block";
    document.getElementById("detailView").style.display = "none";
    this.render();
  }

  openPostDetail(postId) {
    const post = this.posts.find(p => p.id === postId);
    if (!post) {
      this.showToast("존재하지 않거나 삭제된 게시글입니다.", "error");
      this.navigateHome();
      return;
    }

    // 조회수 1 증가
    post.views = (post.views || 0) + 1;
    this.savePosts();

    this.currentPostId = postId;
    window.location.hash = `post-${postId}`;
    this.renderDetail(post);
  }

  handleHashRoute() {
    const hash = window.location.hash;
    if (hash.startsWith("#post-")) {
      const id = parseInt(hash.replace("#post-", ""), 10);
      if (id) {
        this.openPostDetail(id);
        return;
      }
    }
    this.navigateHome();
  }

  // ==========================================
  // 게시글 필터링 & 렌더링
  // ==========================================
  getFilteredPosts() {
    let result = [...this.posts];

    // 1. 카테고리 필터링 ('all'인 경우 모든 채널의 글을 통합 표시)
    if (this.currentCategory !== "all") {
      result = result.filter(p => p.category === this.currentCategory);
    }

    // 2. 검색어 필터링
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(p => 
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.content && p.content.toLowerCase().includes(q)) ||
        (p.author && p.author.toLowerCase().includes(q))
      );
    }

    // 3. 정렬
    if (this.currentSort === "views") {
      result.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (this.currentSort === "likes") {
      result.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    } else {
      // 최신순 (id 역순)
      result.sort((a, b) => b.id - a.id);
    }

    return result;
  }

  render() {
    const filtered = this.getFilteredPosts();
    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / this.PAGE_SIZE) || 1;

    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }

    const startIndex = (this.currentPage - 1) * this.PAGE_SIZE;
    const currentPosts = filtered.slice(startIndex, startIndex + this.PAGE_SIZE);

    // 총 게시글 수 UI
    const totalCountEl = document.getElementById("totalPostsCount");
    if (totalCountEl) totalCountEl.textContent = totalCount;

    // 테이블 렌더링
    const tbody = document.getElementById("boardTableBody");
    const emptyState = document.getElementById("emptyState");

    if (currentPosts.length === 0) {
      tbody.innerHTML = "";
      emptyState.style.display = "block";
    } else {
      emptyState.style.display = "none";
      tbody.innerHTML = currentPosts.map(post => {
        const catBadge = this.getCategoryBadgeHtml(post.category);
        const commentCount = post.comments && post.comments.length > 0 ? ` <span class="comment-count-badge">[${post.comments.length}]</span>` : "";
        
        // 미디어 아이콘 뱃지 (사진 또는 동영상)
        let mediaIcon = "";
        if (post.media) {
          if (post.media.type === "video") {
            mediaIcon = `<i class="fa-solid fa-circle-play has-video-icon" title="동영상 포함"></i> `;
          } else {
            mediaIcon = `<i class="fa-regular fa-image has-image-icon" title="사진 포함"></i> `;
          }
        } else if (post.imageUrl) {
          mediaIcon = `<i class="fa-regular fa-image has-image-icon" title="사진 포함"></i> `;
        }
        
        // 관리자 모드일 경우 삭제 버튼 열 추가
        const adminManageTd = this.isAdmin ? `
          <td onclick="event.stopPropagation()">
            <button class="admin-del-table-btn" onclick="app.adminDeletePost(${post.id})">
              <i class="fa-solid fa-trash-can"></i> 삭제
            </button>
          </td>
        ` : "";

        return `
          <tr onclick="app.openPostDetail(${post.id})">
            <td class="col-num">${post.id}</td>
            <td class="col-category">${catBadge}</td>
            <td class="col-title">
              <div class="table-post-title">
                ${mediaIcon}<span>${this.escapeHtml(post.title)}</span>${commentCount}
              </div>
            </td>
            <td class="col-author"><i class="fa-regular fa-user" style="font-size:11px; margin-right:3px;"></i>${this.escapeHtml(post.author)}</td>
            <td class="col-date">${this.formatDateSimple(post.date)}</td>
            <td class="col-views">${post.views || 0}</td>
            <td class="col-likes">${post.likes || 0}</td>
            ${adminManageTd}
          </tr>
        `;
      }).join("");
    }

    // 관리자 전용 열 헤더 토글
    document.querySelectorAll(".admin-only-col").forEach(el => {
      el.style.display = this.isAdmin ? "table-cell" : "none";
    });

    // 페이지네이션 렌더링
    this.renderPagination(totalPages);
  }

  renderPagination(totalPages) {
    const paginationEl = document.getElementById("pagination");
    if (!paginationEl) return;

    if (totalPages <= 1) {
      paginationEl.innerHTML = `<button class="page-btn active">1</button>`;
      return;
    }

    let html = "";
    // 이전 버튼
    html += `
      <button class="page-btn" ${this.currentPage === 1 ? "disabled" : ""} onclick="app.changePage(${this.currentPage - 1})">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
    `;

    for (let p = 1; p <= totalPages; p++) {
      const activeClass = p === this.currentPage ? "active" : "";
      html += `
        <button class="page-btn ${activeClass}" onclick="app.changePage(${p})">${p}</button>
      `;
    }

    // 다음 버튼
    html += `
      <button class="page-btn" ${this.currentPage === totalPages ? "disabled" : ""} onclick="app.changePage(${this.currentPage + 1})">
        <i class="fa-solid fa-chevron-right"></i>
      </button>
    `;

    paginationEl.innerHTML = html;
  }

  changePage(newPage) {
    this.currentPage = newPage;
    this.render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  getCategoryBadgeHtml(catId) {
    const cat = this.categories.find(c => c.id === catId);
    if (cat) {
      return `<span class="category-badge badge-${cat.id}"><i class="${cat.icon}"></i> ${this.escapeHtml(cat.name)}</span>`;
    }
    return `<span class="category-badge badge-general"><i class="fa-regular fa-comments"></i> 일반</span>`;
  }

  // ==========================================
  // 글 상세 보기 렌더링 & 미디어(사진/동영상) 재생
  // ==========================================
  renderDetail(post) {
    document.getElementById("listView").style.display = "none";
    document.getElementById("detailView").style.display = "block";

    // 카테고리 뱃지
    const catBadgeContainer = document.getElementById("detailCategoryBadge");
    catBadgeContainer.className = `post-category-tag badge-${post.category || 'general'}`;
    catBadgeContainer.innerHTML = this.getCategoryBadgeHtml(post.category || 'general');

    // 텍스트 정보 채우기
    document.getElementById("detailTitle").textContent = post.title;
    document.getElementById("detailAuthor").innerHTML = `<i class="fa-regular fa-user"></i> ${this.escapeHtml(post.author)}`;
    document.getElementById("detailDate").innerHTML = `<i class="fa-regular fa-clock"></i> ${post.date}`;
    document.getElementById("detailViews").textContent = post.views || 0;
    document.getElementById("detailLikes").textContent = post.likes || 0;
    document.getElementById("voteCountBadge").textContent = post.likes || 0;
    
    // 본문 내용
    document.getElementById("detailContent").textContent = post.content;

    // 미디어 렌더링 (사진 또는 동영상)
    const mediaContainer = document.getElementById("detailMediaContainer");
    const detailImg = document.getElementById("detailImage");
    const detailVideo = document.getElementById("detailVideo");

    // 초기화
    detailImg.style.display = "none";
    detailImg.src = "";
    detailVideo.style.display = "none";
    detailVideo.src = "";

    if (post.media) {
      mediaContainer.style.display = "block";
      if (post.media.type === "video") {
        detailVideo.src = post.media.url;
        detailVideo.style.display = "block";
      } else {
        detailImg.src = post.media.url;
        detailImg.style.display = "block";
      }
    } else if (post.imageUrl) {
      mediaContainer.style.display = "block";
      detailImg.src = post.imageUrl;
      detailImg.style.display = "block";
    } else {
      mediaContainer.style.display = "none";
    }

    // 관리자 전용 삭제 버튼 표시 여부
    const adminDelBtn = document.getElementById("detailAdminDeleteBtn");
    adminDelBtn.style.display = this.isAdmin ? "inline-flex" : "none";

    // 댓글 렌더링
    this.renderComments(post);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  renderComments(post) {
    const comments = post.comments || [];
    document.getElementById("detailCommentsCount").textContent = comments.length;
    document.getElementById("commentCountTotal").textContent = comments.length;

    const listContainer = document.getElementById("commentListContainer");
    if (comments.length === 0) {
      listContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0;">작성된 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>`;
      return;
    }

    listContainer.innerHTML = comments.map(c => `
      <div class="comment-item">
        <div class="comment-item-header">
          <div class="comment-author-info">
            <strong><i class="fa-regular fa-user"></i> ${this.escapeHtml(c.author)}</strong>
            <span>${c.date}</span>
          </div>
          <button class="comment-del-btn" onclick="app.deleteComment(${post.id}, ${c.id})">
            <i class="fa-solid fa-xmark"></i> 삭제
          </button>
        </div>
        <div class="comment-body">${this.escapeHtml(c.content)}</div>
      </div>
    `).join("");
  }

  likePost() {
    if (!this.currentPostId) return;
    const post = this.posts.find(p => p.id === this.currentPostId);
    if (post) {
      post.likes = (post.likes || 0) + 1;
      this.savePosts();
      document.getElementById("detailLikes").textContent = post.likes;
      document.getElementById("voteCountBadge").textContent = post.likes;
      this.showToast("개념글로 추천되었습니다!", "success");
    }
  }

  dislikePost() {
    this.showToast("비추천이 반영되었습니다.", "info");
  }

  // ==========================================
  // 댓글 작성 및 삭제
  // ==========================================
  submitComment() {
    if (!this.currentPostId) return;
    const author = document.getElementById("commentAuthorInput").value.trim() || "익명";
    const password = document.getElementById("commentPasswordInput").value.trim() || "1234";
    const content = document.getElementById("commentContentInput").value.trim();

    if (!content) {
      this.showToast("댓글 내용을 입력해주세요.", "error");
      return;
    }

    const post = this.posts.find(p => p.id === this.currentPostId);
    if (!post) return;

    if (!post.comments) post.comments = [];

    const newComment = {
      id: Date.now(),
      author,
      password,
      content,
      date: this.getCurrentDateTime()
    };

    post.comments.push(newComment);
    this.savePosts();

    document.getElementById("commentContentInput").value = "";
    this.renderComments(post);
    this.showToast("댓글이 등록되었습니다.", "success");
  }

  deleteComment(postId, commentId) {
    const post = this.posts.find(p => p.id === postId);
    if (!post || !post.comments) return;

    const commentIndex = post.comments.findIndex(c => c.id === commentId);
    if (commentIndex === -1) return;

    if (this.isAdmin) {
      if (confirm("[관리자 권한] 해당 댓글을 즉시 강제 삭제하시겠습니까?")) {
        post.comments.splice(commentIndex, 1);
        this.savePosts();
        this.renderComments(post);
        this.showToast("관리자 권한으로 댓글이 삭제되었습니다.", "success");
      }
      return;
    }

    const inputPw = prompt("댓글 작성 시 설정한 비밀번호를 입력하세요:");
    if (inputPw === null) return;

    if (inputPw === post.comments[commentIndex].password) {
      post.comments.splice(commentIndex, 1);
      this.savePosts();
      this.renderComments(post);
      this.showToast("댓글이 삭제되었습니다.", "success");
    } else {
      this.showToast("비밀번호가 일치하지 않습니다.", "error");
    }
  }

  // ==========================================
  // 글쓰기 & 사진/동영상 직접 파일 업로드
  // ==========================================
  openWriteModal() {
    document.getElementById("writeModal").style.display = "flex";
    document.getElementById("writeForm").reset();
    this.uploadedMedia = null;
    this.removeUploadedMedia();
    this.renderWriteCategoryOptions();
  }

  closeWriteModal() {
    document.getElementById("writeModal").style.display = "none";
  }

  handleMediaFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // 용량 제한 검사 (로컬 DataURL 저장이므로 25MB 이하 권장)
    if (file.size > 25 * 1024 * 1024) {
      this.showToast("파일 용량은 25MB 이하로 업로드해주세요.", "error");
      e.target.value = "";
      return;
    }

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (!isVideo && !isImage) {
      this.showToast("사진 또는 동영상 파일만 업로드할 수 있습니다.", "error");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      this.uploadedMedia = {
        type: isVideo ? "video" : "image",
        url: dataUrl,
        name: file.name
      };

      const container = document.getElementById("mediaPreviewContainer");
      const imgPreview = document.getElementById("mediaImagePreview");
      const videoPreview = document.getElementById("mediaVideoPreview");
      const fileNameSpan = document.getElementById("mediaFileName");

      container.style.display = "block";
      fileNameSpan.textContent = `[${isVideo ? '동영상' : '사진'}] ${file.name}`;

      if (isVideo) {
        imgPreview.style.display = "none";
        imgPreview.src = "";
        videoPreview.style.display = "block";
        videoPreview.src = dataUrl;
      } else {
        videoPreview.style.display = "none";
        videoPreview.src = "";
        imgPreview.style.display = "block";
        imgPreview.src = dataUrl;
      }

      this.showToast(`${isVideo ? '동영상' : '사진'}이 성공적으로 첨부되었습니다.`, "success");
    };

    reader.readAsDataURL(file);
  }

  removeUploadedMedia() {
    this.uploadedMedia = null;
    const fileInput = document.getElementById("writeMediaFile");
    if (fileInput) fileInput.value = "";

    const container = document.getElementById("mediaPreviewContainer");
    const imgPreview = document.getElementById("mediaImagePreview");
    const videoPreview = document.getElementById("mediaVideoPreview");
    const fileNameSpan = document.getElementById("mediaFileName");

    if (container) container.style.display = "none";
    if (imgPreview) { imgPreview.src = ""; imgPreview.style.display = "none"; }
    if (videoPreview) { videoPreview.src = ""; videoPreview.style.display = "none"; }
    if (fileNameSpan) fileNameSpan.textContent = "";
  }

  submitNewPost(e) {
    e.preventDefault();
    const catRadio = document.querySelector('input[name="writeCategory"]:checked');
    if (!catRadio) {
      this.showToast("게시할 탭(카테고리)을 선택해주세요.", "error");
      return;
    }

    const category = catRadio.value;
    const author = document.getElementById("writeAuthor").value.trim();
    const password = document.getElementById("writePassword").value.trim();
    const title = document.getElementById("writeTitle").value.trim();
    const content = document.getElementById("writeContent").value.trim();

    if (!title || !content || !author || !password) {
      this.showToast("모든 필수 항목을 입력해주세요.", "error");
      return;
    }

    const nextId = this.posts.length > 0 ? Math.max(...this.posts.map(p => p.id)) + 1 : 1;

    const newPost = {
      id: nextId,
      category,
      title,
      author,
      password,
      content,
      media: this.uploadedMedia ? { ...this.uploadedMedia } : null,
      date: this.getCurrentDateTime(),
      views: 0,
      likes: 0,
      comments: []
    };

    this.posts.unshift(newPost);
    this.savePosts();
    this.closeWriteModal();

    this.showToast("게시글이 성공적으로 등록되었습니다!", "success");
    this.currentPage = 1;
    this.render();
  }

  // ==========================================
  // 관리자 모드 시스템 (비밀 코드 인증 및 권한)
  // ==========================================
  openAdminModal() {
    if (this.isAdmin) {
      if (confirm("현재 관리자 모드입니다. 관리자 로그아웃 하시겠습니까?")) {
        this.logoutAdmin();
      }
      return;
    }
    document.getElementById("adminModal").style.display = "flex";
    document.getElementById("adminCodeInput").value = "";
    document.getElementById("adminErrorMsg").style.display = "none";
  }

  closeAdminModal() {
    document.getElementById("adminModal").style.display = "none";
  }

  toggleAdminCodeVisibility() {
    const input = document.getElementById("adminCodeInput");
    const icon = document.getElementById("adminCodeEyeIcon");
    if (input.type === "password") {
      input.type = "text";
      icon.className = "fa-regular fa-eye-slash";
    } else {
      input.type = "password";
      icon.className = "fa-regular fa-eye";
    }
  }

  verifyAdminCode(e) {
    e.preventDefault();
    const inputCode = document.getElementById("adminCodeInput").value.trim();

    if (inputCode === this.getAdminCode()) {
      this.isAdmin = true;
      localStorage.setItem("info_channel_admin", "true");
      this.closeAdminModal();
      this.updateAdminUI();
      this.render();
      if (this.currentPostId) {
        const post = this.posts.find(p => p.id === this.currentPostId);
        if (post) this.renderDetail(post);
      }
      this.showToast("관리자 인증 완료! 채널/아이콘 설정 및 글 관리 권한이 활성화되었습니다.", "success");
    } else {
      document.getElementById("adminErrorMsg").style.display = "block";
    }
  }

  logoutAdmin() {
    this.isAdmin = false;
    localStorage.removeItem("info_channel_admin");
    this.updateAdminUI();
    this.render();
    if (this.currentPostId) {
      const post = this.posts.find(p => p.id === this.currentPostId);
      if (post) this.renderDetail(post);
    }
    this.showToast("관리자 모드가 해제되었습니다.", "info");
  }

  updateAdminUI() {
    const adminBtn = document.getElementById("adminBtn");
    const adminBtnText = document.getElementById("adminBtnText");
    const adminBanner = document.getElementById("adminAlertBanner");
    const channelSettingsBtn = document.getElementById("channelSettingsBtn");

    if (this.isAdmin) {
      if (adminBtn) adminBtn.classList.add("active");
      if (adminBtnText) adminBtnText.textContent = "관리자 모드 (ON)";
      if (adminBanner) adminBanner.style.display = "flex";
      if (channelSettingsBtn) channelSettingsBtn.style.display = "inline-flex";
    } else {
      if (adminBtn) adminBtn.classList.remove("active");
      if (adminBtnText) adminBtnText.textContent = "관리자 로그인";
      if (adminBanner) adminBanner.style.display = "none";
      if (channelSettingsBtn) channelSettingsBtn.style.display = "none";
    }
  }

  // 관리자 권한 글 삭제
  adminDeletePost(postId) {
    if (!this.isAdmin) return;
    if (confirm(`[관리자] ${postId}번 게시글을 즉시 강제 삭제하시겠습니까?`)) {
      this.posts = this.posts.filter(p => p.id !== postId);
      this.savePosts();
      this.render();
      this.showToast(`${postId}번 게시글이 관리자 권한으로 삭제되었습니다.`, "success");
    }
  }

  adminDeleteCurrentPost() {
    if (!this.currentPostId || !this.isAdmin) return;
    if (confirm(`[관리자] 현재 게시글(${this.currentPostId}번)을 즉시 강제 삭제하시겠습니까?`)) {
      this.posts = this.posts.filter(p => p.id !== this.currentPostId);
      this.savePosts();
      this.navigateHome();
      this.showToast("게시글이 관리자에 의해 삭제되었습니다.", "success");
    }
  }

  // 관리자 코드 변경
  openAdminCodeChangeModal() {
    if (!this.isAdmin) return;
    document.getElementById("adminCodeChangeModal").style.display = "flex";
    document.getElementById("newAdminCodeInput").value = "";
    document.getElementById("newAdminCodeConfirmInput").value = "";
  }

  closeAdminCodeChangeModal() {
    document.getElementById("adminCodeChangeModal").style.display = "none";
  }

  submitChangeAdminCode(e) {
    e.preventDefault();
    const newCode = document.getElementById("newAdminCodeInput").value.trim();
    const confirmCode = document.getElementById("newAdminCodeConfirmInput").value.trim();

    if (!newCode || newCode.length < 4) {
      this.showToast("새 관리자 코드는 최소 4자리 이상이어야 합니다.", "error");
      return;
    }

    if (newCode !== confirmCode) {
      this.showToast("입력한 관리자 코드가 서로 일치하지 않습니다.", "error");
      return;
    }

    this.setAdminCode(newCode);
    this.closeAdminCodeChangeModal();
    this.showToast("관리자 코드가 성공적으로 변경되었습니다.", "success");
  }

  // ==========================================
  // 관리자 전용 채널(탭) 및 아이콘/이름 관리 시스템
  // ==========================================
  openChannelManageModal() {
    if (!this.isAdmin) {
      this.showToast("관리자 로그인이 필요한 기능입니다.", "error");
      return;
    }
    document.getElementById("channelManageModal").style.display = "flex";
    this.renderChannelMetaUI();
    this.renderChannelSettingsTable();
    this.hideAddChannelForm();
  }

  closeChannelManageModal() {
    document.getElementById("channelManageModal").style.display = "none";
  }

  saveChannelMeta(e) {
    e.preventDefault();
    const name = document.getElementById("settingChannelName").value.trim();
    const icon = document.getElementById("settingChannelIcon").value.trim() || "fa-solid fa-database";
    const desc = document.getElementById("settingChannelDesc").value.trim();

    if (!name) {
      this.showToast("채널 이름을 입력해주세요.", "error");
      return;
    }

    this.channelMeta = { name, icon, desc };
    this.saveChannelMetaStorage();
    this.renderChannelMetaUI();
    this.showToast("채널 기본 정보가 수정되었습니다.", "success");
  }

  renderChannelSettingsTable() {
    const tbody = document.getElementById("channelSettingsTableBody");
    if (!tbody) return;

    if (this.categories.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">등록된 탭이 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.categories.map(cat => `
      <tr>
        <td style="text-align: center; font-size: 16px;"><i class="${cat.icon}"></i></td>
        <td><strong>${this.escapeHtml(cat.name)}</strong></td>
        <td><code>${this.escapeHtml(cat.id)}</code></td>
        <td>
          <span class="category-badge badge-${cat.id}"><i class="${cat.icon}"></i> ${this.escapeHtml(cat.name)}</span>
        </td>
        <td>
          <div class="channel-action-btns">
            <button class="btn-channel-edit" onclick="app.openEditTabModal('${cat.id}')">
              <i class="fa-solid fa-pen"></i> 수정
            </button>
            <button class="btn-channel-del" onclick="app.deleteChannel('${cat.id}')">
              <i class="fa-solid fa-trash-can"></i> 삭제
            </button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  showAddChannelForm() {
    document.getElementById("addChannelFormContainer").style.display = "block";
    document.getElementById("newChannelId").value = "";
    document.getElementById("newChannelName").value = "";
    document.getElementById("newChannelIcon").value = "fa-solid fa-tag";
  }

  hideAddChannelForm() {
    document.getElementById("addChannelFormContainer").style.display = "none";
  }

  setNewChannelIcon(iconClass) {
    document.getElementById("newChannelIcon").value = iconClass;
  }

  saveNewChannel() {
    const idInput = document.getElementById("newChannelId").value.trim().toLowerCase();
    const nameInput = document.getElementById("newChannelName").value.trim();
    const iconInput = document.getElementById("newChannelIcon").value.trim() || "fa-solid fa-tag";

    if (!idInput || !nameInput) {
      this.showToast("탭 고유ID와 탭 이름을 모두 입력해주세요.", "error");
      return;
    }

    if (idInput === "all") {
      this.showToast("'all'은 전체 통합 탭 전용 예약어입니다. 다른 ID를 입력하세요.", "error");
      return;
    }

    if (this.categories.some(c => c.id === idInput)) {
      this.showToast("이미 존재하는 탭 ID입니다. 다른 ID를 사용해주세요.", "error");
      return;
    }

    this.categories.push({
      id: idInput,
      name: nameInput,
      icon: iconInput
    });

    this.saveCategories();
    this.renderChannelSettingsTable();
    this.renderTabs();
    this.renderWriteCategoryOptions();
    this.render();
    this.hideAddChannelForm();
    this.showToast(`'${nameInput}' 탭이 성공적으로 추가되었습니다!`, "success");
  }

  openEditTabModal(catId) {
    const cat = this.categories.find(c => c.id === catId);
    if (!cat) return;

    document.getElementById("editTabModal").style.display = "flex";
    document.getElementById("editChannelId").value = cat.id;
    document.getElementById("editChannelName").value = cat.name;
    document.getElementById("editChannelIcon").value = cat.icon;
  }

  closeEditTabModal() {
    document.getElementById("editTabModal").style.display = "none";
  }

  setEditChannelIcon(iconClass) {
    document.getElementById("editChannelIcon").value = iconClass;
  }

  submitEditChannel(e) {
    e.preventDefault();
    const id = document.getElementById("editChannelId").value;
    const name = document.getElementById("editChannelName").value.trim();
    const icon = document.getElementById("editChannelIcon").value.trim();

    if (!name || !icon) {
      this.showToast("탭 이름과 아이콘을 모두 입력해주세요.", "error");
      return;
    }

    const cat = this.categories.find(c => c.id === id);
    if (cat) {
      cat.name = name;
      cat.icon = icon;
      this.saveCategories();
      this.closeEditTabModal();
      this.renderChannelSettingsTable();
      this.renderTabs();
      this.renderWriteCategoryOptions();
      this.render();
      if (this.currentPostId) {
        const post = this.posts.find(p => p.id === this.currentPostId);
        if (post) this.renderDetail(post);
      }
      this.showToast(`'${name}' 탭의 이름과 아이콘이 수정되었습니다.`, "success");
    }
  }

  deleteChannel(catId) {
    if (this.categories.length <= 1) {
      this.showToast("최소 1개 이상의 탭이 존재해야 합니다.", "error");
      return;
    }

    const cat = this.categories.find(c => c.id === catId);
    if (!cat) return;

    if (confirm(`'${cat.name}' 탭을 정말 삭제하시겠습니까?\n해당 탭의 기존 글은 '전체' 탭에서 계속 확인 가능합니다.`)) {
      this.categories = this.categories.filter(c => c.id !== catId);
      this.saveCategories();
      if (this.currentCategory === catId) {
        this.currentCategory = "all";
      }
      this.renderChannelSettingsTable();
      this.renderTabs();
      this.renderWriteCategoryOptions();
      this.render();
      this.showToast(`'${cat.name}' 탭이 삭제되었습니다.`, "success");
    }
  }

  // ==========================================
  // 일반 사용자 글 삭제 (비밀번호 검증)
  // ==========================================
  openDeleteModal() {
    document.getElementById("userDeleteModal").style.display = "flex";
    document.getElementById("deletePasswordInput").value = "";
    document.getElementById("deleteErrorMsg").style.display = "none";
  }

  closeDeleteModal() {
    document.getElementById("userDeleteModal").style.display = "none";
  }

  submitUserDelete(e) {
    e.preventDefault();
    if (!this.currentPostId) return;

    const post = this.posts.find(p => p.id === this.currentPostId);
    if (!post) return;

    const inputPw = document.getElementById("deletePasswordInput").value.trim();
    if (inputPw === post.password) {
      this.posts = this.posts.filter(p => p.id !== this.currentPostId);
      this.savePosts();
      this.closeDeleteModal();
      this.navigateHome();
      this.showToast("게시글이 성공적으로 삭제되었습니다.", "success");
    } else {
      document.getElementById("deleteErrorMsg").style.display = "block";
    }
  }

  // ==========================================
  // 검색 & 정렬 & 공지
  // ==========================================
  handleSearch(e) {
    this.searchQuery = e.target.value;
    const clearBtn = document.getElementById("searchClearBtn");
    if (clearBtn) clearBtn.style.display = this.searchQuery ? "block" : "none";
    this.currentPage = 1;
    this.render();
  }

  clearSearch() {
    const input = document.getElementById("searchInput");
    if (input) input.value = "";
    this.searchQuery = "";
    const clearBtn = document.getElementById("searchClearBtn");
    if (clearBtn) clearBtn.style.display = "none";
    this.currentPage = 1;
    this.render();
  }

  handleSortChange() {
    const sortSelect = document.getElementById("sortSelect");
    if (sortSelect) this.currentSort = sortSelect.value;
    this.currentPage = 1;
    this.render();
  }

  openNoticeDetail(e) {
    e.preventDefault();
    alert("[안내 및 가이드]\n\n1. '전체' 탭을 통해 모든 채널의 최신 게시글을 한눈에 통합 조회할 수 있습니다.\n2. 글 작성 시 내 PC의 사진 또는 동영상을 직접 업로드하여 풍성한 게시글을 만들 수 있습니다.\n3. 관리자는 채널(탭)의 이름과 아이콘을 자유롭게 수정하거나 새로운 탭을 추가할 수 있습니다.");
  }

  toggleSubscribe(btn) {
    const span = btn.querySelector("span");
    if (span.textContent === "구독중") {
      span.textContent = "구독하기";
      btn.style.color = "var(--text-sub)";
      this.showToast("채널 구독이 취소되었습니다.", "info");
    } else {
      span.textContent = "구독중";
      btn.style.color = "#fbbf24";
      this.showToast(`${this.channelMeta.name}을(를) 구독했습니다!`, "success");
    }
  }

  // ==========================================
  // 유틸리티
  // ==========================================
  getCurrentDateTime() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d} ${hh}:${mm}`;
  }

  formatDateSimple(dateStr) {
    if (!dateStr) return "";
    return dateStr.split(" ")[0];
  }

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let icon = "fa-solid fa-circle-info";
    if (type === "success") icon = "fa-solid fa-circle-check";
    if (type === "error") icon = "fa-solid fa-triangle-exclamation";

    toast.innerHTML = `<i class="${icon}"></i> <span>${this.escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// 애플리케이션 인스턴스 전역 생성
const app = new InfoChannelApp();
