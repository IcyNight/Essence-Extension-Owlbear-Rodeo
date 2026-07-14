# Essence Powers

Essence Powers is an Owlbear Rodeo extension for tracking a custom D&D homebrew resource system. GMs manage essence libraries, confluence libraries, characters, ownership, visibility, token links, and resource maximums. Players see only visible characters assigned to them and can spend or restore current essence points and confluence uses.

## Install and Run

Install dependencies:

```sh
pnpm install
```

Run locally:

```sh
pnpm dev
```

Build for production:

```sh
pnpm build
```

Run tests:

```sh
pnpm test
```

## Owlbear Rodeo Development Setup

The extension manifest is served at:

```text
http://localhost:5173/manifest.json
```

For the GitHub repository `IcyNight/Essence-Extension-Owlbear-Rodeo`, the GitHub Pages install link is:

```text
https://icynight.github.io/Essence-Extension-Owlbear-Rodeo/manifest.json
```

Use that URL in Owlbear Rodeo after the included GitHub Pages workflow has completed successfully.

Owlbear Rodeo extension iframes may require HTTPS for some development setups. If localhost HTTP is not accepted, expose Vite with an HTTPS tunnel such as Cloudflare Tunnel, ngrok, or a similar tool, then install the public HTTPS `manifest.json` URL in Owlbear Rodeo.

In Owlbear Rodeo, open your profile/extensions area, add a custom extension, and paste the manifest URL. The extension appears as an action titled **Essence Powers**. Clicking it opens the popover panel.

## Publish With GitHub Pages

This project includes `.github/workflows/deploy-pages.yml`. Push the project to the `main` branch of `IcyNight/Essence-Extension-Owlbear-Rodeo`, then enable GitHub Pages with **GitHub Actions** as the source in the repository settings. Each push to `main` runs tests, builds the extension, and publishes `dist`.

## Shared Data

Main campaign data is stored in Owlbear Rodeo room metadata under:

```text
com.codex.essence-powers/data
```

The data includes essences, confluences, powers, characters, ownership, visibility, token IDs, current resources, and maximum resources. Local storage is used only for the GM's last-opened tab.

Owlbear Rodeo room metadata is intended for small extension data and is documented with a 16KB total room metadata limit. Very large power libraries may eventually need a different storage strategy.

## Permissions and Security

The app checks `OBR.player.getRole()` to distinguish GM and player sessions. GM-only actions also pass through service-layer permission checks, so hiding buttons is not the only guard.

Players can only update current essence points, current confluence uses, and long-rest restoration for characters that are both assigned to them and visible to players. They cannot edit libraries, maximum values, owners, assignments, or visibility through the provided UI.

Known limitation: Owlbear Rodeo metadata is client-accessible. This extension implements strong client-side validation for normal Owlbear extension use, but it cannot provide server-enforced anti-tamper security against a malicious custom client.

## GM Workflow

1. Open the **Essence Library** tab.
2. Create an essence, add powers, costs, activation text, and notes.
3. Open the **Confluence Library** tab and do the same for confluences.
4. Open **Characters**.
5. Create a character, choose an owner from connected Owlbear players, assign up to three unique essences and one confluence, set maximum/current resources, and toggle **Visible to Players**.
6. To connect a token, select a scene token in Owlbear Rodeo and press **Use Selected Token** in the character editor.

The GM can reset a character's resources, delete records, load sample data, export shared data to the clipboard, or clear all extension data for debugging.

## Player Workflow

Players open **Essence Powers**, choose an assigned visible character if more than one exists, expand essence or confluence accordions, and press **Use Power**. Power buttons are disabled when the character lacks enough essence points or confluence uses.

The bottom resource dock shows:

```text
Essence Points: current / maximum
Confluence Uses: current / maximum
```

The minus and plus buttons adjust current resources within `0..max`. **LR** asks for confirmation, then restores both resources to maximum.

## Sample Data

The GM-only **Load Sample Data** button adds Fire, Metal, Rune, and Astral Forge examples. It does not run automatically, so existing campaign data is not overwritten by startup.

## Manual Test Checklist

### GM test

- Create essence.
- Add essence power.
- Create confluence.
- Add confluence power.
- Create character.
- Assign 3 essences.
- Assign confluence.
- Assign player.
- Set maximum resources.
- Hide character from players.
- Reveal character to players.
- Adjust resources.
- Reset resources.
- Delete and edit records.

### Player test

- Only assigned character is visible.
- Hidden character is not visible.
- Other players' characters are not visible.
- Essence accordion opens.
- Confluence accordion opens.
- Essence power spends correct points.
- Confluence power spends correct uses.
- Unaffordable powers are disabled.
- Plus and minus buttons respect limits.
- LR restores both resources.

### Synchronization test

- GM changes character assignment and player view updates.
- Player spends a point and GM view updates.
- GM hides a character and player view updates.
- LR updates all connected views.

## Implementation Notes

The app reads the latest shared data immediately before each resource mutation and writes back the updated character. Owlbear room metadata updates are partial at the metadata-key level, so this reduces stale writes but does not provide transactional conflict resolution between simultaneous edits.

The data includes a `version` field and a migration layer. Corrupt or outdated saved data is normalized where possible and unsafe records are ignored rather than crashing the panel.
