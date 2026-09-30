import re

class Guardrails:
    INJECTION_PATTERNS = [
        r"ignore (all )?previous instructions",
        r"system prompt",
        r"you are now (a|an)",
        r"override guidelines",
        r"disregard (the )?above",
        r"jailbreak",
        r"<script.*?>",
    ]

    @classmethod
    def sanitize_input(cls, text: str) -> str:
        """Sanitizes user input and removes common injection vectors."""
        if not text:
            return ""
        cleaned = text.strip()
        for pattern in cls.INJECTION_PATTERNS:
            cleaned = re.sub(pattern, "[filtered]", cleaned, flags=re.IGNORECASE)
        return cleaned

    @classmethod
    def is_safe(cls, text: str) -> bool:
        """Checks if text contains hostile or unsafe instructions."""
        if not text:
            return True
        for pattern in cls.INJECTION_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                return False
        return True
