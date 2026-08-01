# Universal values and semantic projections

Status: incubation implementation contract.

This specification extends the JuanPage 2.0 field value algebra without introducing another document schema, component tree, renderer, or M1 record type.

A semantic value is a bounded array whose first element is a reserved tag. Every remaining element is an M1-compatible scalar: string, finite number, Boolean, or null. This means a typed value can travel as a normal M1 fact and materialize as a normal JuanPage field.

## Design constraints

- Data only. Values never contain HTML, CSS, JavaScript, callbacks, component names, or executable code.
- Bounded. Every tuple has explicit length, point-count, bucket-count, matrix-size, text, and URL limits.
- Serializable. A value survives JSON encoding without custom classes or prototypes.
- M1 compatible. Every value is a flat scalar tuple accepted by the existing Fact opcode.
- Fail closed. A reserved tag with an invalid shape is rejected instead of falling back to an untyped list.
- Presentation independent. Tags describe meaning, not a requested visual widget.

## Value tuples

| Tag | Tuple | Meaning |
|---|---|---|
| `instant` | `["instant", iso]` | One ISO-8601 instant |
| `interval` | `["interval", start, end, includeStart, includeEnd]` | Ordered temporal interval |
| `duration` | `["duration", amount, unit]` | Duration in a named unit |
| `recurrence` | `["recurrence", rule, timezoneOrNull]` | Bounded recurrence rule and optional timezone |
| `coordinate` | `["coordinate", system, x, y, zOrNull]` | Coordinate in an explicit reference system |
| `bounds` | `["bounds", system, minX, minY, maxX, maxY, minZOrNull, maxZOrNull]` | Two- or three-dimensional bounds |
| `path` | `["path", system, dimensions, ...ordinates]` | Ordered two- or three-dimensional path, at most 15 points |
| `geometry` | `["geometry", shape, system, dimensions, ...ordinates]` | Point, line, or polygon geometry, at most 15 points |
| `content` | `["content", mediaType, urlOrNull, inlineTextOrNull, labelOrNull, digestOrNull]` | Addressable or inline content resource |
| `content-range` | `["content-range", resourceId, unit, start, end]` | Addressable byte, character, line, item, or second range |
| `media` | `["media", mediaType, url, altOrNull, durationOrNull, trackOrNull]` | Typed media resource with alternate text and optional track |
| `time-range` | `["time-range", startSeconds, endSeconds, trackOrNull]` | Addressable media range |
| `quantity` | `["quantity", value, unit]` | Numeric quantity with unit identity |
| `uncertainty` | `["uncertainty", value, lower, upper, confidence]` | Estimate, bounds, and confidence from zero through one |
| `distribution` | `["distribution", unit, label1, value1, ...]` | Up to 20 named numeric buckets |
| `matrix` | `["matrix", rows, columns, rowLabelsJson, columnLabelsJson, ...values]` | Dense matrix up to 6 by 6 |

Normal scalar lists remain supported. A list beginning with a reserved semantic tag must satisfy that tag's complete tuple contract.

## Generalized projection families

`src/projection/universal.ts` defines semantic projection specifications and deterministic evaluation results. A projection consumes JuanPage objects and relations; it never asks the runtime to instantiate a named component.

| Family | Meaning | Result |
|---|---|---|
| `categorical` | Aggregate a numeric measure by a scalar dimension | Ordered buckets with contributing object IDs |
| `temporal` | Place objects at instants or intervals, optionally in lanes | Ordered temporal events |
| `matrix` | Aggregate by row and column dimensions | Rows, columns, and addressed cells |
| `hierarchy` | Resolve parent-child meaning through a field or relation kind | Ordered nodes and roots, with cycle rejection |
| `network` | Project typed relations between source objects | Nodes and directed or undirected edges |
| `spatial` | Select coordinate, bounds, path, or geometry fields | Spatial features retaining source identity |
| `document` | Order content fields with optional addressable ranges | Ordered content blocks |
| `stream` | Order authored or threaded objects by time | Ordered events with author, thread, and content |

All results preserve object and relation identities so a later renderer binding can emit the same typed inspect, scope, selection, and operation deltas already used elsewhere in JuanPager.

## Current boundary

This tranche implements the value algebra, M1 transport compatibility, direct JuanPage validation, deterministic projection evaluation, public SDK exports, hostile-input rejection, and baseline display through the existing scalar-array rendering path.

The next canonical tranche must add universal interaction state and adaptive visual projections to `renderPage`: expansion, semantic paths, viewport and zoom, ranges, playheads, ordering, focus anchors, and simulation clocks. Those changes must use these values and projection results rather than create calendar, map, tree, graph, editor, chat, or media component schemas.
