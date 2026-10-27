package textutil

import (
	"math"
	"regexp"
	"strconv"
	"strings"
)

var presentationDimension = regexp.MustCompile(`^(\d+(?:\.\d+)?|\.\d+)(px|em|rem|%)?$`)
var presentationHexColor = regexp.MustCompile(`^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$`)
var presentationRGBColor = regexp.MustCompile(`^(rgb|rgba)\(([^()]*)\)$`)
var presentationInteger = regexp.MustCompile(`^\d+$`)

// SanitizePresentationStyle retains only bounded, passive presentation values.
// It is deliberately not a general CSS parser: escapes, comments, rules,
// arbitrary functions and layout/interaction properties are unsupported.
// Declaration order is preserved, with the last valid duplicate winning.
func SanitizePresentationStyle(input string) string {
	if strings.ContainsAny(input, `\{}<>@`) || strings.Contains(input, "/*") || strings.Contains(input, "*/") {
		return ""
	}
	for _, c := range input {
		if (c < 32 && c != '\t' && c != '\n' && c != '\r' && c != '\f') || c == 127 {
			return ""
		}
	}
	type declaration struct{ property, value string }
	var declarations []declaration
	for _, part := range strings.Split(input, ";") {
		property, value, ok := strings.Cut(part, ":")
		if !ok {
			continue
		}
		property = strings.ToLower(strings.TrimSpace(property))
		value = strings.ToLower(strings.Join(strings.Fields(value), " "))
		if value == "" || strings.Contains(value, "!") || strings.Contains(value, "url(") || strings.Contains(value, "var(") || strings.Contains(value, "expression(") {
			continue
		}
		if property == "background" {
			property = "background-color"
		}
		clean, valid := sanitizePresentationValue(property, value)
		if !valid {
			continue
		}
		for i := len(declarations) - 1; i >= 0; i-- {
			if declarations[i].property == property {
				declarations = append(declarations[:i], declarations[i+1:]...)
			}
		}
		declarations = append(declarations, declaration{property, clean})
	}
	result := make([]string, 0, len(declarations))
	for _, d := range declarations {
		result = append(result, d.property+":"+d.value)
	}
	return strings.Join(result, ";")
}

func sanitizePresentationValue(property, value string) (string, bool) {
	switch property {
	case "color", "background-color":
		return presentationColor(value)
	case "font-size":
		return presentationLength(value, map[string][2]float64{"px": {8, 48}, "em": {.5, 3}, "rem": {.5, 3}, "%": {50, 300}}, false)
	case "font-weight":
		if oneOf(value, "normal", "bold", "bolder", "lighter") {
			return value, true
		}
		if n, err := strconv.Atoi(value); err == nil && n >= 100 && n <= 900 && !strings.ContainsAny(value, "+-") {
			return strconv.Itoa(n), true
		}
	case "font-style":
		return value, oneOf(value, "normal", "italic", "oblique")
	case "display":
		return value, oneOf(value, "block", "inline", "inline-block")
	case "width":
		if value == "auto" {
			return value, true
		}
		return presentationLength(value, map[string][2]float64{"px": {0, 720}, "em": {0, 4}, "rem": {0, 4}, "%": {0, 100}}, true)
	case "height":
		return value, value == "auto"
	case "line-height":
		if value == "normal" {
			return value, true
		}
		return presentationLength(value, map[string][2]float64{"": {1, 3}, "px": {12, 96}, "em": {1, 3}, "rem": {1, 3}, "%": {100, 300}}, false)
	case "letter-spacing":
		if value == "normal" {
			return value, true
		}
		return presentationLength(value, map[string][2]float64{"px": {0, 8}, "em": {0, .5}, "rem": {0, .5}}, true)
	case "text-align":
		return value, oneOf(value, "left", "right", "center", "justify", "start", "end")
	case "text-decoration":
		parts := strings.Fields(value)
		if len(parts) > 3 || len(parts) == 0 {
			return "", false
		}
		for _, part := range parts {
			if !oneOf(part, "none", "underline", "line-through", "overline") {
				return "", false
			}
		}
		return strings.Join(parts, " "), true
	case "text-indent":
		return presentationLength(value, map[string][2]float64{"px": {0, 48}, "em": {0, 3}, "rem": {0, 3}}, true)
	case "margin", "margin-top", "margin-right", "margin-bottom", "margin-left", "padding", "padding-top", "padding-right", "padding-bottom", "padding-left":
		return presentationList(value, shorthandCount(property, "margin", "padding"), func(part string) (string, bool) {
			if strings.HasPrefix(property, "margin") && part == "auto" {
				return part, true
			}
			return presentationLength(part, map[string][2]float64{"px": {0, 64}, "em": {0, 4}, "rem": {0, 4}}, true)
		})
	case "border", "border-top", "border-right", "border-bottom", "border-left":
		parts, valid := presentationParts(value)
		if !valid || len(parts) == 0 || len(parts) > 3 {
			return "", false
		}
		var result []string
		seen := map[string]bool{}
		for _, part := range parts {
			kind := ""
			clean := ""
			if width, ok := presentationLength(part, map[string][2]float64{"px": {0, 4}}, true); ok {
				kind, clean = "width", width
			} else if oneOf(part, "none", "solid", "dashed", "dotted", "double") {
				kind, clean = "style", part
			} else if color, ok := presentationColor(part); ok {
				kind, clean = "color", color
			}
			if kind == "" || seen[kind] {
				return "", false
			}
			seen[kind] = true
			result = append(result, clean)
		}
		return strings.Join(result, " "), true
	case "border-width":
		return presentationList(value, 4, func(part string) (string, bool) {
			return presentationLength(part, map[string][2]float64{"px": {0, 4}}, true)
		})
	case "border-style":
		return presentationList(value, 4, func(part string) (string, bool) {
			return part, oneOf(part, "none", "solid", "dashed", "dotted", "double")
		})
	case "border-color":
		return presentationList(value, 4, presentationColor)
	case "border-radius":
		return presentationList(value, 4, func(part string) (string, bool) {
			return presentationLength(part, map[string][2]float64{"px": {0, 32}, "em": {0, 2}, "rem": {0, 2}, "%": {0, 50}}, true)
		})
	case "vertical-align":
		return value, oneOf(value, "baseline", "middle", "top", "bottom", "text-top", "text-bottom", "sub", "super")
	}
	return "", false
}

func shorthandCount(property string, shorthands ...string) int {
	if oneOf(property, shorthands...) {
		return 4
	}
	return 1
}

func presentationLength(value string, units map[string][2]float64, allowZero bool) (string, bool) {
	match := presentationDimension.FindStringSubmatch(value)
	if match == nil {
		return "", false
	}
	n, err := strconv.ParseFloat(match[1], 64)
	if err != nil || math.IsInf(n, 0) || math.IsNaN(n) {
		return "", false
	}
	if n == 0 && match[2] == "" && allowZero {
		return "0", true
	}
	bound, exists := units[match[2]]
	if !exists || n < bound[0] || n > bound[1] {
		return "", false
	}
	return strconv.FormatFloat(n, 'f', -1, 64) + match[2], true
}

func presentationColor(value string) (string, bool) {
	if presentationHexColor.MatchString(value) || oneOf(value, "transparent", "currentcolor", "black", "silver", "gray", "grey", "white", "maroon", "red", "purple", "fuchsia", "green", "lime", "olive", "yellow", "navy", "blue", "teal", "aqua") {
		return value, true
	}
	match := presentationRGBColor.FindStringSubmatch(value)
	if match == nil {
		return "", false
	}
	parts := strings.Split(match[2], ",")
	expected := 3
	if match[1] == "rgba" {
		expected = 4
	}
	if len(parts) != expected {
		return "", false
	}
	for i, part := range parts {
		part = strings.TrimSpace(part)
		if i < 3 {
			if !presentationInteger.MatchString(part) {
				return "", false
			}
			n, err := strconv.Atoi(part)
			if err != nil || n < 0 || n > 255 {
				return "", false
			}
			parts[i] = strconv.Itoa(n)
		} else {
			alpha, ok := presentationLength(part, map[string][2]float64{"": {0, 1}}, false)
			if !ok {
				return "", false
			}
			parts[i] = alpha
		}
	}
	return match[1] + "(" + strings.Join(parts, ",") + ")", true
}

func presentationParts(value string) ([]string, bool) {
	var parts []string
	depth, start := 0, 0
	for i, c := range value {
		switch c {
		case '(':
			depth++
			if depth > 1 {
				return nil, false
			}
		case ')':
			depth--
			if depth < 0 {
				return nil, false
			}
		case ' ':
			if depth == 0 {
				if i > start {
					parts = append(parts, value[start:i])
				}
				start = i + 1
			}
		}
	}
	if depth != 0 {
		return nil, false
	}
	if start < len(value) {
		parts = append(parts, value[start:])
	}
	return parts, true
}

func presentationList(value string, max int, sanitize func(string) (string, bool)) (string, bool) {
	parts, ok := presentationParts(value)
	if !ok || len(parts) == 0 || len(parts) > max {
		return "", false
	}
	for i, part := range parts {
		clean, ok := sanitize(part)
		if !ok {
			return "", false
		}
		parts[i] = clean
	}
	return strings.Join(parts, " "), true
}

func oneOf(value string, candidates ...string) bool {
	for _, candidate := range candidates {
		if value == candidate {
			return true
		}
	}
	return false
}
