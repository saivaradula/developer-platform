(function() {
  var COOKIE_TIMEOUT_MS = 900000;
  var STORAGE_KEY = 'LUCYBOT_RECIPE_CREDS';
  var user = {};

  var LOGGED_IN_HTML = '<li class="navbar-link"><a onclick="setKalturaUser()">Sign Out</a></li>';
  var LOGGED_OUT_HTML = '<li class="navbar-link"><a data-toggle="modal" data-target="#KalturaSignInModal">Sign In</a></li>'
        + '<li class="navbar-link"><a href="/?signup=true">Sign Up</a></li>';

  var setUser = window.setKalturaUser = function(creds) {
    if (!creds) {
      user = {};
      window.jquery('#KalturaAuthLinks').html(LOGGED_OUT_HTML);
      return;
    } else {
      window.jquery('#KalturaAuthLinks').html(LOGGED_IN_HTML);
    }
    user = creds;
    window.onAuthorization(creds, function(err, ks) {
      user.ks = creds.ks = ks;
      var now = new Date();
      var expires = new Date(now.getTime() + COOKIE_TIMEOUT_MS);
      var cookie = STORAGE_KEY + '=' + encodeURIComponent(JSON.stringify(creds)) + '; expires=' + expires.toUTCString() + '; Path=/';
      document.cookie = cookie;
      window.secretService.secrets.ks = creds.ks;
      window.secretService.secrets.partnerId = creds.partnerId;
      window.secretService.secrets.userId = creds.userId;
      window.secretService.secrets.secret = creds.secret;
    })
  }

  window.startKalturaLogin = function() {
    user.email = window.jquery('input[name="KalturaEmail"]').val();
    user.password = window.jquery('input[name="KalturaPassword"]').val();
    mixpanel.track('login_submit', {
      email: user.email,
    });
    window.jquery.ajax({
      url: '/auth/login',
      method: 'POST',
      data: JSON.stringify({email: user.email, password: user.password}),
      headers: {'Content-Type': 'application/json'},
    })
    .done(function(response) {
      window.jquery('#KalturaSignInModal').modal('hide');
      window.jquery('#KalturaPartnerIDModal').modal('show');
      mixpanel.identify(user.email);
      mixpanel.people.set({
        '$email': user.email,
      })
      mixpanel.track('login_success', {
        email: user.email,
      });
      var partnerChoicesHTML = response.map(function(partner) {
        return '<li><a onclick="setKalturaPartnerID(' + partner.id + ')">' + partner.name + ' (' + partner.id + ')</a></li>'
      }).join('\n');
      window.jquery('#KalturaPartnerIDModal').find('ul.dropdown-menu').html(partnerChoicesHTML);
    })
    .fail(function(xhr) {
      mixpanel.track('login_error', {
        email: user.email,
        error: xhr.responseText,
      })
      alert("Error logging in: " + xhr.responseText);
    })
  }

  window.setKalturaPartnerID = function(id) {
    window.jquery('#KalturaPartnerIDModal').modal('hide');
    user.partnerId = id;
    window.jquery.ajax({
      url: '/auth/selectPartner',
      method: 'POST',
      data: JSON.stringify(user),
      headers: {'Content-Type': 'application/json'},
    })
    .done(function(data) {
      var creds = {
        secret: data.adminSecret,
        userId: user.email,
        partnerId: user.partnerId,
      }
      setUser(creds);
      $('#KalturaPartnerIDModal').modal('hide');
    })
    .fail(function(xhr) {
      mixpanel.track('login_error', {
        partnerId: user.partnerId,
        email: user.email,
        error: xhr.responseText,
      })
      alert('Error logging in ' + xhr.responseText);
    })
  }

  window.jquery(document).ready(function() {
    setUser();
    var cookies = document.cookie.split(';').map(function(c) {return c.trim()});
    var credCookie = cookies.filter(function(c) {
      return c.indexOf(STORAGE_KEY) === 0;
    })[0];
    if (credCookie) {
      var stored = credCookie.substring(STORAGE_KEY.length + 1) || '{}';
      var user;
      try {
        user = JSON.parse(decodeURIComponent(stored));
      } catch(e) {}
      if (user) setUser(user);
    }
  });
})();