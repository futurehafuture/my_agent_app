/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          // 定义一套类似 ChatGPT 的深色主题色
          'chat-bg': '#343541',
          'sidebar-bg': '#202123',
          'user-msg': '#343541',
          'ai-msg': '#444654',
        }
      },
    },
    plugins: [],
  }