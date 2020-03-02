// makes it easy to reset and initialize the DB with vendor and vendor item data
module.exports = [
    {
        "vendorName": "Books",
        "vendorDesc": "look out Amazon!",
        "id": 2,
        "items": [
            {
                "itemId": 1,
                "name": "C Programming Language",
                "description": "'C is quirky, flawed, and an enormous success.' - Dennis Ritchie",
                "imgLink": "vendor_images/books/C_Programming_Language.jpg",
                "price": 45.85
            },
            {
                "itemId": 2,
                "name": "Clean Code",
                "description": "life doesn't have to be that hard",
                "imgLink": "vendor_images/books/clean_code.jpg",
                "price": 20.25
            },
            {
                "itemId": 3,
                "name": "Into To Algorithmns 3rd Edition",
                "description": "caution: mild altering properties",
                "imgLink": "vendor_images/books/intro_to_algorithms.jpg",
                "price": 140.70
            },
            {
                "itemId": 4,
                "name": "Power Of Habit",
                "description": "self-programming is the best kind of programming",
                "imgLink": "vendor_images/books/power_of_habit.jpg",
                "price": 10.99
            },
            {
                "itemId": 5,
                "name": "Mystery Collection",
                "description": "A random collections of books for the risk taker",
                "imgLink": "vendor_images/books/mystery_collection.jpg",
                "price": 60.45
            }
        ]
    },
    {
        "vendorName": "E-Restaurant",
        "vendorDesc": "delivered fresh (don't ask how, that is a trade secret)",
        "id": 3,
        "items": [
            {
                "itemId": 6,
                "name": "Various Breads",
                "description": "!gluten-free",
                "imgLink": "vendor_images/food/breads.jpg",
                "price": 23.50
            },
            {
                "itemId": 7,
                "name": "Blueberry Cheesecake Pie",
                "description": "share it with some friends!",
                "imgLink": "vendor_images/food/blueberry_cheesecake.jpg",
                "price": 20.25
            },
            {
                "itemId": 8,
                "name": "Royale With Cheese",
                "description": "popular with our French clients",
                "imgLink": "vendor_images/food/cheeseburger.jpg",
                "price": 7.99
            },
            {
                "itemId": 9,
                "name": "Coffee Milk",
                "description": "milk with a hint of coffee",
                "imgLink": "vendor_images/food/coffee_milk.jpg",
                "price": 4.95
            },
            {
                "itemId": 10,
                "name": "Macaroons",
                "description": "you say you'll have one but...",
                "imgLink": "vendor_images/food/macaroons.jpg",
                "price": 23.37
            }
        ]
    }
]