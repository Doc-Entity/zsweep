<script>
    import "../app.css";
    import { onMount } from 'svelte';
    import { currentTheme } from '$lib/themeStore';
    
    // Just importing the store is enough to trigger the subscription
    // that applies the CSS variables.
</script>

<slot />
