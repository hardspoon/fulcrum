<script setup>
import DefaultTheme from 'vitepress/theme'
const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #home-hero-after>
      <div class="hero-showcase">
        <img src="/tasks-kanban-board.png" alt="Vibora Kanban Board">
      </div>
    </template>
  </Layout>
</template>
