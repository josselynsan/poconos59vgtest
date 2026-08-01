$(function() {

    // Mobile Menu
    function mobileMenu(menuId, mobileBtn) {
        $(mobileBtn).on('click', (e) => {
            e.preventDefault();
        });

        const menuTemplate = `
            <div class="moby-inner">
                <div class="moby-close">
                    <span class="moby-close-icon"></span>
                </div>
                <div class="moby-wrap">
                    <div>
                        <div class="moby-menu"></div>
                    </div>
                </div>
            </div>
        `;

        new Moby({
            menu: $(menuId),
            mobyTrigger: $(mobileBtn),
            menuClass: "right-side",
            template: menuTemplate,
            subMenuOpenIcon: '<i class="far fa-angle-down"></i>',
            subMenuCloseIcon: '<i class="far fa-angle-up"></i>',
        });
    }
    mobileMenu('#site-menu', '.menu-btn a');

    // Countdown
    function timer(minutes, container) {
        const getTime = new Date(Date.now() + minutes * 60000);
        const nowTime = new Date();

        let expTimeLocalStorage = localStorage.getItem("expTime");
        let endTime;

        if (!expTimeLocalStorage || expTimeLocalStorage === "undefined") {
            localStorage.setItem("expTime", getTime);
            endTime = getTime;
        } else {
            endTime = new Date(expTimeLocalStorage);
            if (nowTime > endTime) {
                localStorage.setItem("expTime", getTime);
                endTime = getTime;
            }
        }

        const year = endTime.getFullYear();
        const month = endTime.getMonth() + 1;
        const day = endTime.getDate();
        const time = `${endTime.getHours()}:${endTime.getMinutes()}:${endTime.getSeconds()}`;
        const result = `${year}/${month}/${day} ${time}`;

        container.countdown(result, (event) => {
            container.html(event.strftime(`
            <div class="timer-item">
                <span class="digits">%H</span>
                <span class="label">hr</span>
            </div>
            <div class="div">:</div>
            <div class="timer-item">
                <span class="digits">%M</span>
                <span class="label">min</span>
            </div>
            <div class="div">:</div>
            <div class="timer-item">
                <span class="digits">%S</span>
                <span class="label">sec</span>
            </div>
        `));
        });
    }
    timer(45, $(".timerA"));

    // GALLERY
    $('.site-images__slider').each(function(){
        $(this).each(function(){
            $(this).owlCarousel({
                loop: true,
                nav: false,
                responsive: {
                    0: {
                        items: 1,
                        margin: 3,
                        dots: true,
                        startPosition: 3
                    },
                    768: {
                        items: 3,
                        margin: 11,
                        startPosition: 2
                    },
                    992: {
                        items: 4,
                        margin: 11,
                        startPosition: 1
                    },
                    1200: {
                        items: 6,
                        margin: 11
                    }
                }
            });
        });
    });
});