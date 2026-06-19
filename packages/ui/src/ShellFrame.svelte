<script lang="ts">
  interface NavItem {
    title: string;
    href: string;
  }

  let {
    appTitle,
    profileName,
    navItems,
    children
  }: {
    appTitle: string;
    profileName: string;
    navItems: NavItem[];
    children: import('svelte').Snippet;
  } = $props();
</script>

<div class="app-shell">
  <aside class="sidebar">
    <div class="brand">
      <p class="eyebrow">Modular App</p>
      <h1>{appTitle}</h1>
      <p class="profile">{profileName}</p>
    </div>

    <nav>
      {#each navItems as item, itemIndex (itemIndex)}
        <a href={item.href}>{item.title}</a>
      {/each}
    </nav>
  </aside>

  <main class="content">
    {@render children()}
  </main>
</div>

<style>
  .app-shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 18rem 1fr;
    font-family: var(--font-family, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
    background:
      radial-gradient(circle at top left, color-mix(in srgb, var(--color-accent, #d1a549), transparent 82%), transparent 26rem),
      linear-gradient(180deg, color-mix(in srgb, var(--color-background, #f6f1e8), white 10%), var(--color-background, #efe6d8));
    color: var(--color-foreground, #2d2418);
  }

  .sidebar {
    padding: 2rem 1.25rem;
    border-right: 1px solid color-mix(in srgb, var(--color-border, #4a361c), transparent 40%);
    background: color-mix(in srgb, var(--color-panel, #fffaf7), transparent 28%);
    backdrop-filter: blur(12px);
  }

  .brand h1 {
    margin: 0.2rem 0 0;
    font-size: 1.8rem;
  }

  .eyebrow,
  .profile {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 0.72rem;
    opacity: 0.72;
  }

  nav {
    margin-top: 2rem;
    display: grid;
    gap: 0.65rem;
  }

  nav a {
    text-decoration: none;
    color: inherit;
    padding: 0.75rem 0.9rem;
    border-radius: 0.9rem;
    background: color-mix(in srgb, var(--color-muted, #775625), transparent 72%);
  }

  .content {
    padding: 2rem;
  }

  @media (max-width: 800px) {
    .app-shell {
      grid-template-columns: 1fr;
    }

    .sidebar {
      border-right: 0;
      border-bottom: 1px solid color-mix(in srgb, var(--color-border, #4a361c), transparent 40%);
    }
  }
</style>
