$(document).ready(function() {
    $('.open-video').each(function() {
        $(this).magnificPopup({
            type: 'inline',
            midClick: true,
            closeBtnInside: true,
            fixedContentPos: true,
            fixedBgPos: true,
            mainClass: 'mfp-fade',
            items: {
                src: '<div id="video-container"><video id="hls-video" controls></video></div>',
                type: 'inline'
            },
            callbacks: {
                open: function() {
                    var video = document.getElementById('hls-video');
                    var videoSrc = $(this.st.el).data('video-url');
                    if (Hls.isSupported()) {
                        var hls = new Hls();
                        hls.loadSource(videoSrc);
                        hls.attachMedia(video);
                        hls.on(Hls.Events.MANIFEST_PARSED, function () {
                            video.play();
                        });
                    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                        video.src = videoSrc;
                        video.addEventListener('loadedmetadata', function() {
                            video.play();
                        });
                    }
                },
                close: function() {
                    var video = document.getElementById('hls-video');
                    video.pause();
                    video.currentTime = 0;
                }
            }
        });
    })
});
