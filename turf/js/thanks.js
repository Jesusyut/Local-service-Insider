"use strict";
const token = new URLSearchParams(location.search).get("t");
if (token)
  document.querySelector("#manage").href =
    "book.html?t=" + encodeURIComponent(token);
