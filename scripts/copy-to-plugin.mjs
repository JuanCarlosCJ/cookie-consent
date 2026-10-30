// Copies the built script into the WordPress plugin, and exports the known rules as JSON
// so the plugin's server-side rewriting uses exactly the same list as the script.
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { KNOWN_RULES } from '../src/rules.ts'

const assets = 'wordpress/cookie-consent/assets'
mkdirSync(assets, { recursive: true })
copyFileSync('dist/cookie-consent.min.js', `${assets}/cookie-consent.min.js`)

const rules = KNOWN_RULES.map(r => ({
  name: r.name,
  category: r.category,
  on: r.on ?? 'both',
  ...(typeof r.pattern === 'string'
    ? { contains: r.pattern }
    : { regex: r.pattern.source, flags: r.pattern.flags }),
}))
writeFileSync(`${assets}/rules.json`, JSON.stringify(rules, null, 2) + '\n')

console.log(`Copied the script and ${rules.length} rules into ${assets}/`)
