def get_next_difficulty(current_difficulty: str = "medium", score: float = 7.0) -> str:
    """
    Computes adaptive question difficulty:
    - Score >= 8.0: promotes difficulty (easy -> medium, medium -> hard, hard -> hard)
    - Score < 5.0: demotes difficulty (hard -> medium, medium -> easy, easy -> easy)
    - Otherwise: maintains current difficulty
    """
    diff = (current_difficulty or "medium").lower()
    if score >= 8.0:
        if diff == "easy":
            return "medium"
        elif diff == "medium":
            return "hard"
        return "hard"
    elif score < 5.0:
        if diff == "hard":
            return "medium"
        elif diff == "medium":
            return "easy"
        return "easy"
    return diff if diff in ("easy", "medium", "hard") else "medium"
