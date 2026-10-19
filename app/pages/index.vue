<template>
  <div />
</template>

<script setup lang="ts">
// 이 사이트는 관리자 전용이므로 첫 화면은 항상 관리자 영역으로 보낸다
// (로그인 전이면 admin 미들웨어가 /admin/login으로, 부관리자면 super-admin 미들웨어가 회원 목록으로 이동시킨다).
await navigateTo('/admin/dashboard', { replace: true })
</script>
