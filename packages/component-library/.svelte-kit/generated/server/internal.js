
import root from '../root.js';
import { set_building, set_prerendering } from '$app/env/internal';
import { set_assets } from '$app/paths/internal/server';
import { set_manifest, set_read_implementation } from '__sveltekit/server';
import { set_private_env, set_public_env } from '../../../../../node_modules/@sveltejs/kit/src/runtime/shared-server.js';
import error from '../shared/error-template.js';

export const options = {
	app_template_contains_nonce: false,
	async: false,
	csp: {"mode":"auto","directives":{"upgrade-insecure-requests":false,"block-all-mixed-content":false},"reportOnly":{"upgrade-insecure-requests":false,"block-all-mixed-content":false}},
	csrf_check_origin: true,
	csrf_trusted_origins: [],
	embedded: false,
	env_public_prefix: 'PUBLIC_',
	env_private_prefix: '',
	hash_routing: false,
	hooks: null, // added lazily, via `get_hooks`
	preload_strategy: "modulepreload",
	root,
	service_worker: false,
	service_worker_options: undefined,
	server_error_boundaries: false,
	templates: {
		app: ({ head, body, assets, nonce, env }) => "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content\" />\n    <meta name=\"theme-color\" content=\"#1d3a2f\" />\n    <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\" />\n    <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin />\n    <link href=\"https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Arimo:ital,wght@0,400..700;1,400..700&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Nunito:ital,wght@0,200..1000;1,200..1000&display=swap\" rel=\"stylesheet\" />\n    <script>\n      (() => {\n        const storageKey = 'modular-app-theme-preference';\n        const defaultPreference = {\n          theme: 'paper',\n          scale: 'medium',\n          fontFamily: 'system',\n          authBackgroundPattern: 'topography',\n          appBackgroundPatternOpacity: 0.35\n        };\n        const darkThemes = new Set(['midnight', 'dark', 'forest', 'neon']);\n        const storedFonts = {\n          inter: '\"Inter\", ui-sans-serif, system-ui, -apple-system, sans-serif',\n          arial: '\"Arimo\", Arial, \"Helvetica Neue\", Helvetica, sans-serif',\n          poppins: '\"Poppins\", ui-sans-serif, system-ui, sans-serif',\n          nunito: '\"Nunito\", ui-sans-serif, system-ui, sans-serif',\n          system: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif'\n        };\n\n        let preference = defaultPreference;\n\n        try {\n          const raw = window.localStorage.getItem(storageKey);\n          if (raw) {\n            preference = { ...defaultPreference, ...JSON.parse(raw) };\n          }\n        } catch {\n          preference = defaultPreference;\n        }\n\n        const root = document.documentElement;\n        root.dataset.theme = preference.theme;\n        root.dataset.scale = preference.scale;\n        root.dataset.font = preference.fontFamily;\n        root.dataset.authPattern = preference.authBackgroundPattern;\n        root.style.setProperty('--app-background-pattern-opacity', String(preference.appBackgroundPatternOpacity));\n        root.style.setProperty('--font-family', storedFonts[preference.fontFamily] ?? storedFonts.system);\n        root.classList.toggle('dark', darkThemes.has(preference.theme));\n      })();\n    </script>\n    <style>\n      html {\n        font-family: var(--font-family, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif);\n        background-color: oklch(0.985 0.006 85);\n        color: oklch(0.23 0.012 262);\n      }\n\n      html[data-theme=\"dark\"] {\n        background-color: oklch(0.15 0.005 250);\n        color: oklch(0.98 0.005 250);\n      }\n\n      html[data-theme=\"midnight\"] {\n        background-color: oklch(0.18 0.02 255);\n        color: oklch(0.94 0.012 255);\n      }\n\n      html[data-theme=\"forest\"] {\n        background-color: oklch(0.97 0.013 145);\n        color: oklch(0.24 0.018 150);\n      }\n\n      html[data-font=\"inter\"] {\n        font-family: \"Inter\", ui-sans-serif, system-ui, -apple-system, sans-serif;\n      }\n\n      html[data-font=\"arial\"] {\n        font-family: \"Arimo\", Arial, \"Helvetica Neue\", Helvetica, sans-serif;\n      }\n\n      html[data-font=\"poppins\"] {\n        font-family: \"Poppins\", ui-sans-serif, system-ui, sans-serif;\n      }\n\n      html[data-font=\"nunito\"] {\n        font-family: \"Nunito\", ui-sans-serif, system-ui, sans-serif;\n      }\n\n      html[data-font=\"system\"] {\n        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;\n      }\n\n      body {\n        min-height: 100vh;\n        margin: 0;\n        background: transparent;\n        color: inherit;\n        font-family: inherit;\n      }\n    </style>\n    " + head + "\n  </head>\n  <body data-sveltekit-preload-data=\"hover\">\n    <div style=\"display: contents\">" + body + "</div>\n  </body>\n</html>\n",
		error
	},
	version_hash: "hhnzo"
};

export async function get_hooks() {
	let handle;
	let handleFetch;
	let handleError;
	let handleValidationError;
	let init;
	

	let reroute;
	let transport;
	

	return {
		handle,
		handleFetch,
		handleError,
		handleValidationError,
		init,
		reroute,
		transport
	};
}

export { set_assets, set_building, set_manifest, set_prerendering, set_private_env, set_public_env, set_read_implementation };
