# Tailwind + Ant Design Migration Guide

## Scope

This repository uses `antd` as the primary component and layout system. Tailwind CSS is the utility layer used to replace local component-level `.css` files over time.

## Style Ownership

- Use Ant Design for component primitives and structural layout: `Layout`, `Drawer`, `Modal`, `Tabs`, `Card`, `Form`, `Flex`, `Space`, `Row`, `Col`.
- Use Tailwind for spacing, sizing, alignment, responsive behavior, overflow, and lightweight visual tuning that stays local to a component.
- Keep a minimal global stylesheet in [`src/index.css`](/Users/zhengjiyuan/Desktop/fantastic-couscous/src/index.css) for the Tailwind entrypoint, document-level resets, shared CSS variables, and a small number of global keyframes when utilities are not a good fit.

## Theme Rules

- Route shared color, radius, and shadow decisions through [`src/theme/appTheme.ts`](/Users/zhengjiyuan/Desktop/fantastic-couscous/src/theme/appTheme.ts).
- Prefer Ant Design tokens before introducing new hard-coded values into components.
- Avoid new `.ant-*` selector overrides unless there is no component token or supported API for the adjustment.

## Migration Sequence

1. Migrate shell and navigation wrappers first.
2. Migrate medium-complexity panels next.
3. Split large shared stylesheets before converting them to Tailwind utilities.

## Non-Goals

- Do not rewrite stable feature logic as part of the styling migration.
- Do not force every remaining global rule into Tailwind if a small global CSS rule is simpler and more maintainable.
