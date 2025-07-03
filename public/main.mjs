let savedFeltTemperature; // 전역 변수 선언
let weatherLevel;
const serverHost = "http://localhost:9092";

// Base64URL → Base64 디코딩
function b64UrlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = str.length % 4;
  if (pad) str += "=".repeat(4 - pad);
  return atob(str);
}

// 토큰 만료 여부 확인
function isTokenExpired(token) {
  if (!token) return true;
  try {
    const { exp } = JSON.parse(b64UrlDecode(token.split(".")[1])); // exp: 초
    return Date.now() >= exp * 1000;
  } catch {
    return true;
  }
}

function forceLogout(msg = "로그인이 필요한 기능입니다.") {
  if (sessionStorage.getItem("alreadyLoggedOut")) return;
  sessionStorage.setItem("alreadyLoggedOut", "1");
  alert(msg);
  window.location.href = "/";
}

/********************************************************************
 * 1.  초기 로그인 상태 판정 & 버튼 토글
 ********************************************************************/
const signUpBtn = document.getElementById("signUp");
const logInBtn = document.getElementById("logIn");
const logOutBtn = document.getElementById("logOut");
const wishlistBtn = document.getElementById("Wishlist");
const doFetchBtn = document.getElementById("doFetchDataButton");
const userIdDisplay = document.getElementById("userIdDisplay");

let token = localStorage.getItem("token");
let currentUserIdx = Number(localStorage.getItem("user_idx")) || null; // 위시리스트 용 현재 유저 idx

const managerBtn = document.getElementById("manager");
// 예: token에서 관리자 여부 판단
let isManager = false;
if (token) {
  try {
    const payload = JSON.parse(b64UrlDecode(token.split(".")[1]));
    if (payload.userid === "admin") {
      isManager = true;
    }
  } catch (e) {
    console.error("토큰 디코딩 실패:", e);
  }
}
if (!isManager) {
  managerBtn.style.display = "none";
}

// // 만료된 토큰 발견 시 제거 + 강제 로그아웃
// if (token && isTokenExpired(token)) {
//   localStorage.removeItem("token");
//   forceLogout();
// }

// 버튼 표시
if (token) {
  signUpBtn.style.display = "none";
  logInBtn.style.display = "none";
  logOutBtn.style.display = "inline";

  //토큰에서 userid 추출하여 표시
  try {
    const payload = JSON.parse(b64UrlDecode(token.split(".")[1]));
    if (payload.idx) {
      currentUserIdx = payload.idx;
      localStorage.setItem("user_idx", payload.idx);
    }
    if (payload.userid) {
      localStorage.setItem("userid", payload.userid);
      userIdDisplay.textContent = `${payload.userid}님 환영합니다!`;
      userIdDisplay.style.display = "inline";
    }
  } catch {
    userIdDisplay.style.display = "none";
  }
} else {
  signUpBtn.style.display = "inline";
  logInBtn.style.display = "inline";
  logOutBtn.style.display = "none";
  userIdDisplay.style.display = "none";
}

/********************************************************************
 * 2.  네비게이션 이벤트
 ********************************************************************/
signUpBtn.addEventListener(
  "click",
  () => (window.location.href = "/auth/signUp")
);
logInBtn.addEventListener(
  "click",
  () => (window.location.href = "/auth/logIn")
);
wishlistBtn.addEventListener("click", (e) => {
  e.preventDefault();
  window.location.href = "/wish";
});

logOutBtn.addEventListener("click", (e) => {
  e.preventDefault();
  localStorage.removeItem("token");
  alert("로그아웃 되었습니다.");
  window.location.href = "/";
});

/********************************************************************
 * 3.  보호 POST 요청 헬퍼 (토큰 부착 + 401 처리)
 * // 위시리스트 하트용
 ********************************************************************/
async function protectedFetch(url, opt = {}) {
  const tk = localStorage.getItem("token");
  if (!tk || isTokenExpired(tk)) return forceLogout();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${tk}`, ...opt.headers },
    ...opt,
  });
  if (res.status === 401) return forceLogout();
  return res;
}
const protectedPost = (url, body) =>
  protectedFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

// ***************************************
// POST: main.html에서 날씨 API 설정값 보내고, 추천 옷을 결과로 받아오는 기능
document
  .getElementById("doFetchDataButton")
  .addEventListener("click", async function getRecommendedClothes() {
    const baseDate = document
      .getElementById("base_date")
      .value.replace(/-/g, ""); // 'YYYY-MM-DD' 형식을 'YYYYMMDD'로 변환
    const baseTime = document.getElementById("base_time").value; // 기준 시간 (예: '0500', '0800' 등)
    const nx = document.getElementById("nx").value; // 격자 X좌표 (위도 기반)
    const ny = document.getElementById("ny").value; // 격자 Y좌표 (경도 기반)

    const res = await fetch("/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nx: nx,
        ny: ny,
        baseDate: baseDate,
        baseTime: baseTime,
      }),
    });
    const result = await res.json();
    if (!res.ok || !result) return console.log("추천결과가 없습니다.");

    if (res.ok) {
      const recommendation = result.recommendedResult;
      savedFeltTemperature = result.feltTemperature; // 전역변수에 할당
      weatherLevel = result.level;

      // console.log(savedFeltTemperature);
      if (recommendation) {
        console.log("받은결과: ", recommendation);
        // console.log(recommendation.idx);
        // console.log(recommendation.category);
        // console.log(recommendation.image_url);
        // 프론트 각 div에 뿌려주기
        const categories = document.querySelectorAll(".category");
        // 기존 이미지 제거
        // categories.forEach((categoryDiv) => {
        //   categoryDiv.innerHTML = ""; // 내부 모든 요소 제거 (즉, 이전 이미지 초기화)
        // });
        categories.forEach((categoryDiv) => {
          // 이미지만 제거
          categoryDiv
            .querySelectorAll("a.product-link")
            .forEach((link) => link.remove());
        });
        // 기존 하트제거
        document.querySelectorAll(".heart").forEach((h) => {
          h.textContent = "♡";
          delete h.dataset.productIdx; // ★
        });

        // 새 이미지 추가
        recommendation.forEach((recommendation) => {
          const image = document.createElement("img");
          // image.src = `${serverHost}/${recommendation.image_url}`;
          image.src = `${recommendation.image_url}`;
          image.alt = `추천 상품 ${recommendation.idx}`;
          image.classList.add("product-image"); // 스타일을 위해 클래스 추가 가능

          // 링크만들기
          const link = document.createElement("a");
          link.href = recommendation.url; // 여기에 판매 링크 URL 삽입
          link.target = "_blank"; // 새 탭에서 열기
          link.classList.add("product-link");

          link.appendChild(image); // 링크태그 안에 이미지 태그삽입

          // 해당 category에 맞는 DOM 요소에 추가
          categories.forEach((categoryDiv) => {
            if (categoryDiv.classList.contains(recommendation.category)) {
              categoryDiv.appendChild(link); // <a><img></a> 구조로 삽입
              // 카테고리를 저장해두기 위해 data-category 속성 추가
              image.dataset.category = recommendation.category;
              // // forEach문 돌면서 하트 추가.
              const heart = categoryDiv.querySelector(".heart");
              if (heart) {
                heart.dataset.productIdx = recommendation.idx;
                heart.textContent = "♡";
              }
            }
          });
        });
        // DOM에 추가한 이미지들 다시 수집해서 저장
        // const savedRecommendations = [];
        // document.querySelectorAll(".product-image").forEach((img) => {
        //   savedRecommendations.push({
        //     src: img.src,
        //     alt: img.alt,
        //     category: img.dataset.category,
        //   });
        // });
        // localStorage에 저장
        // localStorage.setItem(
        //   "savedRecommendations",
        //   JSON.stringify(savedRecommendations)
        // );

        // 수정된 로컬스토리지 저장방법
        localStorage.setItem(
          "savedRecommendations",
          JSON.stringify(
            recommendation.map((r) => ({
              // src: `${serverHost}/${r.image_url}`,
              src: `${r.image_url}`,
              alt: `추천 상품 ${r.idx}`,
              category: r.category,
              productIdx: r.idx,
              url: r.url, // 추가
            }))
          )
        );

        console.log(JSON.parse(localStorage.getItem("savedRecommendations")));
      } else {
        console.log("추천 결과가 없습니다.");
      }
    } else {
      console.log(result);
    }
    // await markWishlisted();
  });

// POST 옷 다시 추천 기능 **************
// re_recommend
document
  .getElementById("re_recommend")
  .addEventListener("click", async function ReRecommend() {
    // 날씨 먼저 조회하도록 방어.
    if (typeof weatherLevel === "undefined" || weatherLevel === null) {
      alert("먼저 날씨를 조회해주세요!");
      return;
    }
    const res = await fetch("/recommend/again", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: weatherLevel,
      }),
    });
    const result = await res.json();
    if (!res.ok || !result) return console.log("추천결과가 없습니다.");

    if (res.ok) {
      const recommendation = result.recommendedResult;

      if (recommendation) {
        console.log("받은결과: ", recommendation);
        // 프론트 각 div에 뿌려주기
        const categories = document.querySelectorAll(".category");
        // 기존 이미지 제거
        categories.forEach((categoryDiv) => {
          categoryDiv
            .querySelectorAll("a.product-link")
            .forEach((link) => link.remove());
        });
        // 기존 하트제거
        document.querySelectorAll(".heart").forEach((h) => {
          h.textContent = "♡";
          delete h.dataset.productIdx; // ★
        });

        // 새 이미지 추가
        recommendation.forEach((recommendation) => {
          const image = document.createElement("img");
          // image.src = `${serverHost}/${recommendation.image_url}`;
          image.src = `${recommendation.image_url}`;
          image.alt = `추천 상품 ${recommendation.idx}`;
          image.classList.add("product-image"); // 스타일을 위해 클래스 추가 가능

          // 링크만들기
          const link = document.createElement("a");
          link.href = recommendation.url; // 여기에 판매 링크 URL 삽입
          link.target = "_blank"; // 새 탭에서 열기
          link.classList.add("product-link");

          link.appendChild(image); // 링크태그 안에 이미지 태그삽입

          // 해당 category에 맞는 DOM 요소에 추가
          categories.forEach((categoryDiv) => {
            if (categoryDiv.classList.contains(recommendation.category)) {
              categoryDiv.appendChild(link); // <a><img></a> 구조로 삽입
              // 카테고리를 저장해두기 위해 data-category 속성 추가
              image.dataset.category = recommendation.category;
              // // forEach문 돌면서 하트 추가.
              const heart = categoryDiv.querySelector(".heart");
              if (heart) {
                heart.dataset.productIdx = recommendation.idx;
                heart.textContent = "♡";
              }
            }
          });
        });

        // 수정된 로컬스토리지 저장방법
        localStorage.setItem(
          "savedRecommendations",
          JSON.stringify(
            recommendation.map((r) => ({
              // src: `${serverHost}/${r.image_url}`,
              src: `${r.image_url}`,
              alt: `추천 상품 ${r.idx}`,
              category: r.category,
              productIdx: r.idx,
              url: r.url, // 추가
            }))
          )
        );

        console.log(JSON.parse(localStorage.getItem("savedRecommendations")));
      } else {
        console.log("추천 결과가 없습니다.");
      }
    } else {
      console.log(result);
    }
    // await markWishlisted();
  });

// 옷 색상 적용 기능
document
  .getElementById("apply-btn")
  .addEventListener("click", async function applyColors() {
    // 날씨 먼저 조회하도록 방어.
    if (typeof weatherLevel === "undefined" || weatherLevel === null) {
      alert("먼저 날씨를 조회해주세요!");
      return;
    }
    // 상의 색상
    const topColor = document.getElementById("topColorPicker").value;
    const topSvg = document.getElementById("top-svg");
    const topRects = topSvg.querySelectorAll("rect");

    topRects.forEach((rect) => {
      // 목 부분은 fill:none이므로 제외
      if (rect.getAttribute("fill") !== "none") {
        rect.setAttribute("fill", topColor);
      }
    });
    // POST: 적용하기 버튼 누르면 사용자가 선택한 색상 rgb값을 바탕으로 옷 추천화면이 새로고침 되는 기능
    const topColorPicker = document.getElementById("topColorPicker").value;

    const res = await fetch("/recommend/reloadByColor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topColor: topColorPicker,
        // bottomColor: bottomColorPicker,
        level: weatherLevel,
      }),
    });
    const result = await res.json();
    if (!res.ok || !result) return console.log("추천결과가 없습니다.");

    if (res.ok) {
      const recommendation = result.recommendedResult;
      if (recommendation) {
        console.log("받은결과: ", recommendation);
        // 프론트 각 div에 뿌려주기
        const categories = document.querySelectorAll(".category");
        // 기존 이미지, 링크 제거
        categories.forEach((categoryDiv) => {
          categoryDiv
            .querySelectorAll("a.product-link")
            .forEach((link) => link.remove());
        });
        // 기존 하트제거
        document.querySelectorAll(".heart").forEach((h) => {
          h.textContent = "♡";
          delete h.dataset.productIdx; // ★
        });

        // 새 이미지 추가
        recommendation.forEach((recommendation) => {
          const image = document.createElement("img");
          // image.src = `${serverHost}/${recommendation.image_url}`;
          image.src = `${recommendation.image_url}`;
          image.alt = `추천 상품 ${recommendation.idx}`;
          image.classList.add("product-image"); // 스타일을 위해 클래스 추가 가능

          // 링크만들기
          const link = document.createElement("a");
          link.href = recommendation.url; // 여기에 판매 링크 URL 삽입
          link.target = "_blank"; // 새 탭에서 열기
          link.classList.add("product-link");

          link.appendChild(image); // 링크태그 안에 이미지 태그삽입

          // 해당 category에 맞는 DOM 요소에 추가
          categories.forEach((categoryDiv) => {
            if (categoryDiv.classList.contains(recommendation.category)) {
              categoryDiv.appendChild(link); // <a><img></a> 구조로 삽입
              // 카테고리를 저장해두기 위해 data-category 속성 추가
              image.dataset.category = recommendation.category;
              // // forEach문 돌면서 하트 추가.
              const heart = categoryDiv.querySelector(".heart");
              if (heart) {
                heart.dataset.productIdx = recommendation.idx;
                heart.textContent = "♡";
              }
            }
          });
        });

        // 수정된 로컬스토리지 저장방법
        localStorage.setItem(
          "savedRecommendations",
          JSON.stringify(
            recommendation.map((r) => ({
              // src: `${serverHost}/${r.image_url}`,
              src: `${r.image_url}`,
              alt: `추천 상품 ${r.idx}`,
              category: r.category,
              productIdx: r.idx,
              url: r.url, // 추가
            }))
          )
        );

        console.log(JSON.parse(localStorage.getItem("savedRecommendations")));
      } else {
        console.log("추천 결과가 없습니다.");
      }
    } else {
      console.log(result);
    }
    // await markWishlisted();
  });

// 로컬스토리지에 저장한 추천옷을 새로고침하면 다시 불러오는 기능.
// function restoreRecommendationsFromLocalStorage() {
//   const saved = localStorage.getItem("savedRecommendations");
//   if (!saved) return;
//   const savedRecommendations = JSON.parse(saved);
//   const categories = document.querySelectorAll(".category");

//   savedRecommendations.forEach((item) => {
//     const image = document.createElement("img");
//     image.src = item.src;
//     image.alt = item.alt;
//     image.classList.add("product-image");

//     categories.forEach((categoryDiv) => {
//       if (categoryDiv.classList.contains(item.category)) {
//         categoryDiv.appendChild(image);
//       }
//     });
//   });
// }
function restoreRecommendationsFromLocalStorage() {
  const saved = localStorage.getItem("savedRecommendations");
  if (!saved) return;
  const items = JSON.parse(saved);
  items.forEach((it) => {
    document.querySelectorAll(`.category.${it.category}`).forEach((div) => {
      const img = document.createElement("img");
      // img.src = `${serverHost}/${it.src}`;
      img.src = `${it.src}`;
      img.alt = it.alt;
      img.className = "product-image";

      const link = document.createElement("a");
      link.href = it.url;
      link.target = "_blank";
      link.className = "product-link";
      link.appendChild(img);

      div.appendChild(link);
      const heart = div.querySelector(".heart");
      if (heart) heart.dataset.productIdx = it.productIdx;
    });
  });
}
//
async function markWishlisted() {
  if (!currentUserIdx) return;
  const res = await protectedFetch(`/wish/mine?user_idx=${currentUserIdx}`);
  if (!res.ok) return;
  const wished = (await res.json()).map((w) => Number(w.product_idx));
  document.querySelectorAll(".heart").forEach((h) => {
    if (wished.includes(Number(h.dataset.productIdx))) h.textContent = "❤️";
  });
}

document.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("heart")) return;
  if (!currentUserIdx) return alert("로그인 후 이용 가능합니다!");
  const heart = e.target,
    productIdx = Number(heart.dataset.productIdx);
  if (!productIdx) return alert("추천을 먼저 받아주세요!");
  const like = heart.textContent === "♡";
  heart.textContent = like ? "❤️" : "♡";
  const body = { user_idx: currentUserIdx, product_idx: productIdx };
  let res;
  if (like) {
    res = await protectedPost("/wish", body);
    if (res.status === 400) return; // ★ 이미 담긴 상품
  } else {
    res = await protectedFetch("/wish", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  if (!res.ok) {
    alert("위시리스트 저장 실패");
    heart.textContent = like ? "♡" : "❤️";
  }
});

fetch("/product/hotpicks")
  .then((res) => {
    if (!res.ok) {
      throw new Error(`서버 오류: ${res.status}`);
    }
    return res.json();
  })
  .then((data) => {
    if (!Array.isArray(data)) {
      throw new Error("응답 데이터가 배열이 아닙니다.");
    }

    data.forEach((item, index) => {
      const div = document.getElementById(`pick${index + 1}`);
      if (!div) {
        console.warn(`div#pick${index + 1}가 존재하지 않습니다.`);
        return;
      }

      const { image_url, url, name } = item;

      if (!image_url) {
        console.warn(`상품 ${index + 1}에 이미지 URL이 없습니다.`);
        return;
      }

      // a 태그 생성
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      // img 태그 생성
      const img = document.createElement("img");
      // img.src = serverHost + "/" + image_url;
      img.src = image_url;
      img.alt = name || `pick${index + 1}`;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.style.borderRadius = "12px";

      // 링크 안에 이미지 넣기
      link.appendChild(img);
      // div에 링크 추가
      div.appendChild(link);
    }); // <- 이게 forEach의 닫힘
  }) // <- 이게 .then 닫힘
  .catch((err) => {
    console.error("핫픽 로딩 실패:", err);
  });

window.addEventListener("load", function () {
  sessionStorage.removeItem("alreadyLoggedOut"); // 새로고침 또는 재방문 시 초기화
  // restoreRecommendationsFromLocalStorage();
  // ❷ 토큰 확인 후 markWishlisted 실행
  const token = localStorage.getItem("token");
  if (token && !isTokenExpired(token)) {
    markWishlisted();
  }
});
