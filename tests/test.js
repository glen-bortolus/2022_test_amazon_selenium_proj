const { fs } = require("fs");
const {By, Key, Builder} = require("selenium-webdriver");
const by = require("selenium-webdriver/lib/by");
const { threadId } = require("worker_threads");
require("chromedriver");

//Constant selectors for easy changes

    //ID and Name selectors
    const addToCartButton = "add-to-cart-button";
    const cartSelector = "attach-sidesheet-view-cart-button";
    const categoryDropDownID = "searchDropdownBox";
    const searchBoxID = "twotabsearchtextbox";
    const searchButtonID = "nav-search-submit-button";
    const navigateToCart = "nav-cart";
    const home = 'nav-logo-sprites';

    //Xpath selectors
    const categorySelected = "//option[@selected='selected']";
    const primeCheckboxClickXpath = "//div[@id='primeRefinements']//i[contains(@class,'checkbox')]";
    const primeCheckboxXpath = "//div[@id='primeRefinements']//input[@type='checkbox']";
    const firstSearchResult = "//div[contains(@class,'s-product-image-container')]";
    const quantityDropDown = "//span[contains(@class,'a-dropdown-container')]";
    const addedToCartIndicator = "//*[text()='Added to Cart']";
    const itemQuantityInCart = "//span[contains(@class,'a-dropdown-prompt')]";
    const compareLink = "//form[@id='activeCartViewForm']//span[@data-action='compare']//input[@type='submit']";
    const deleteFromList = "//form[@id='activeCartViewForm']//span[@data-action='delete']//input[@type='submit']";
    const compareHeading = "//div[@class='a-popover-wrapper']//h1[contains(text(),'Compare')]";
    const closeModal = "//button[contains(@class,'a-button-close')]";

class shoppingItem{
    constructor(itemName, itemCategory, itemQuantity){
        this.itemName = itemName;
        this.itemCategory = itemCategory;
        this.itemQuantity = itemQuantity;
    }
}

async function runTests(environment){
    var fs = require('fs');
    var logger = fs.createWriteStream('log.txt', {
        flags: 'a'
    });


    // in a more fleshed out version, I would pass these in by reading in a csv file
    var shoppingList = [
        new shoppingItem("Magnifying Glass", "Industrial & Scientific", 7), //This case fulfills A-1, the other items are for A-2
        new shoppingItem("Selenium Web Driver", "Selenium Web Driver", 8), //Selenium Web Driver is not an Amazon Category :(
        new shoppingItem("Microscope", "Industrial & Scientific", -5), //We cannot purchase -5 items on Amazon. At least to my knowledge.
        new shoppingItem("Microscope", "Industrial & Scientific", 20) //Max quantity is 5 for this item, Amazon will stop us.
    ]

    var url = "";

    // A-3 answer
    switch(environment){
        case "prod":
            url = "https://amazon.com";
            break;
        case "staging":
            url = "https://staging.amazon.com";
            break;
        case "qa":
            url = "https://qa.amazon.com";
            break;
        case "dev":
            url = "https://dev.amazon.com";
            break;
        default:
            url = "https://amazon.com";
            break;
    }

    logger.write("Item Name | Item Category | Item Quantity | Test Result");
    
    // ideally we wouldn't have to reset the driver and website between tests, but in the event we get stuck it's good to plan ahead.
    for(i = 0; i < shoppingList.length; i++)
    {
        let driver = await new Builder().forBrowser("chrome").build();

        await driver.get(url);

        await driver.manage().window().maximize();
        var feedback = await test_case(driver, shoppingList[i]);
        feedbackString = `\n${shoppingList[i].itemName + " | " + shoppingList[i].itemCategory + " | " + shoppingList[i].itemQuantity + " | " + feedback}`;
        logger.write(feedbackString);

        await driver.quit();
    }
    logger.end();

}

async function test_case(driver, purchaseRequest){

    var item = purchaseRequest.itemName;
    var category = purchaseRequest.itemCategory;
    var quantity = purchaseRequest.itemQuantity;

    

    try{

        //searching for item and category
        await driver.findElement(By.id(searchBoxID)).sendKeys(item);

        await driver.findElement(By.id(categoryDropDownID)).click();

        //using category parameter to fill out the xpath
        await driver.findElement(By.xpath("//option[text() = '" + category + "']")).click();

        await driver.findElement(By.id(searchButtonID)).click();

        //validating item and category
        var amazonSearchField = await driver.findElement(By.id(searchBoxID)).getAttribute("value");

        if (amazonSearchField != item)
        {
            throw Error("Search field did not stay correctly populated");
        }

        var amazonSearchCategory = await driver.findElement(By.xpath(categorySelected)).getText();

        if(amazonSearchCategory != category)
        {
            throw Error("Correct search category was not retained");
        }

        /*
        This one is a little tricky. I wasn't sure if you wanted verification that the results are checked to filter to prime delivery
        only or to check every item and verify it can delivered through prime. I chose to do the former as checking if the filtering
        is valid would be more appropriate on the back end. Additionally, the prime checkbox isn't available for filtering
        if you're not logged in. In this case, I adjusted my selector to also work for the free shipping checkbox when not logged in.
        */

        //Prime Delivery filtering

        await driver.findElement(By.xpath(primeCheckboxClickXpath)).click();

        var primeChecked = await driver.findElement(By.xpath(primeCheckboxXpath)).getAttribute("checked");

        console.log(primeChecked);

        if(primeChecked == null)
        {
            throw Error("Prime delivery filtering did not work.")
        }

        //Selecting an item and adding to cart
        await driver.findElement(By.xpath(firstSearchResult)).click();

        await driver.findElement(By.xpath(quantityDropDown)).click();

        //using quantity parameter to fill out the xpath
        await driver.findElement(By.xpath("//ul[@role='listbox']/li/a[text() = " + quantity + "]")).click();

        await driver.findElement(By.id(addToCartButton)).click();
        
        await driver.manage().setTimeouts( { implicit: 10000 } );

        var addedIndicator = await driver.findElement(By.xpath(addedToCartIndicator));

        if(addedIndicator == null){
            throw Error("Item was not added to cart.");
        }

        //navigating to the cart from the slide out
        await driver.findElement(By.id(cartSelector)).click();

        //validating quantity (note: would not work for adding items that are already in the cart without checking quantity already in cart and using in calcs)
        var quantityInCart = await driver.findElement(By.xpath(itemQuantityInCart)).getText();

        if(quantityInCart != quantity){
            throw Error("The wrong quantity of " + item + " was added to the cart. Desired quantity: "+ quantity + ", Current Quantity: " + quantityInCart);
        }

        await driver.findElement(By.xpath(compareLink)).click();

        var popoverVisible = driver.findElement(By.xpath(compareHeading));

        if(popoverVisible == null){
            throw Error("Compare with similar items did not display the popover.");
        }

        await driver.findElement(By.xpath(closeModal)).click();

        //clean up for potentially running the same item through again in consecutive tests without closing browser
        await driver.findElement(By.xpath(deleteFromList)).click();
        return ("Success. Test passed.")
    }
    catch(Error){
        return("Failure. Reason: " + Error.message);
    }
}

runTests("prod");