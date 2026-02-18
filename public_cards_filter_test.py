#!/usr/bin/env python3
"""
Additional test to verify public cards filtering logic
"""

import requests
import json

BACKEND_URL = "https://nfc-connect-3.preview.emergentagent.com/api"

def test_public_cards_filtering():
    """Test that public cards endpoint correctly filters cards"""
    print("🔍 Testing public cards filtering logic...")
    
    # Test without authentication
    response = requests.get(f"{BACKEND_URL}/public/cards")
    
    if response.status_code == 200:
        cards = response.json()
        print(f"✅ Found {len(cards)} public cards")
        
        # Verify filtering rules
        for card in cards:
            is_public = card.get('is_public', False)
            show_in_feed = card.get('show_in_feed', True)  # Default to True if not set
            
            print(f"   Card {card['id'][:8]}...: is_public={is_public}, show_in_feed={show_in_feed}")
            
            # All cards should be public
            if not is_public:
                print(f"❌ ERROR: Non-public card found: {card['id']}")
                return False
            
            # Cards should either have show_in_feed=True or show_in_feed not defined
            if show_in_feed is False:
                print(f"❌ ERROR: Card with show_in_feed=False found: {card['id']}")
                return False
        
        print("✅ All public cards correctly filtered")
        return True
    else:
        print(f"❌ ERROR: {response.status_code} - {response.text}")
        return False

if __name__ == "__main__":
    success = test_public_cards_filtering()
    exit(0 if success else 1)