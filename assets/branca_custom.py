"""
Colormap
--------
Utility module for dealing with colormaps.
"""

import json
import math
import os
from jinja2 import Template
from branca.element import ENV, Figure, JavascriptLink, MacroElement
from branca.utilities import legend_scaler

rootpath = os.path.abspath(os.path.dirname(__file__))

with open(os.path.join(rootpath, '_cnames.json')) as f:
    _cnames = json.loads(f.read())

with open(os.path.join(rootpath, '_schemes.json')) as f:
    _schemes = json.loads(f.read())


def _is_hex(x):
    return x.startswith('#') and len(x) == 7


def _parse_hex(color_code):
    return (int(color_code[1:3], 16),
            int(color_code[3:5], 16),
            int(color_code[5:7], 16))


def _parse_color(x):
    if isinstance(x, (tuple, list)):
        color_tuple = tuple(x)[:4]
    elif isinstance(x, (str, bytes)) and _is_hex(x):
        color_tuple = _parse_hex(x)
    elif isinstance(x, (str, bytes)):
        cname = _cnames.get(x.lower(), None)
        if cname is None:
            raise ValueError('Unknown color {!r}.'.format(cname))
        color_tuple = _parse_hex(cname)
    else:
        raise ValueError('Unrecognized color code {!r}'.format(x))
    if max(color_tuple) > 1.:
        color_tuple = tuple(u/255. for u in color_tuple)
    return tuple(map(float, (color_tuple+(1.,))[:4]))


def _base(x):
    if x > 0:
        base = pow(10, math.floor(math.log10(x)))
        return round(x/base)*base
    else:
        return 0


class ColorMap(MacroElement):
    """A generic class for creating colormaps.
    Parameters
    ----------
    vmin: float
        The left bound of the color scale.
    vmax: float
        The right bound of the color scale.
    caption: str
        A caption to draw with the colormap.
    max_labels : int, default 10
        Maximum number of legend tick labels
    """
    _template = ENV.get_template('color_scale.js')

    def __init__(self, vmin=0., vmax=1., caption='', labels='', max_labels=10):
        super(ColorMap, self).__init__()
        self._name = 'ColorMap'

        self.vmin = vmin
        self.vmax = vmax
        self.caption = caption
        self.index = [vmin, vmax]
        self.labels = labels #added by Elizabeth Altenau.
        self.max_labels = max_labels

    def render(self, **kwargs):
        """Renders the HTML representation of the element."""
        self.color_domain = [self.vmin + (self.vmax-self.vmin) * k/499. for
                             k in range(500)]
        self.color_range = [self.__call__(x) for x in self.color_domain]
        self.tick_labels = legend_scaler(self.labels, self.max_labels) #changed self.index to self.labels by Elizabeth Altenau.

        super(ColorMap, self).render(**kwargs)

        figure = self.get_root()
        assert isinstance(figure, Figure), ('You cannot render this Element '
                                            'if it is not in a Figure.')

        figure.header.add_child(JavascriptLink("https://cdnjs.cloudflare.com/ajax/libs/d3/3.5.5/d3.min.js"), name='d3')  # noqa

    def rgba_floats_tuple(self, x):
        """
        This class has to be implemented for each class inheriting from
        Colormap. This has to be a function of the form float ->
        (float, float, float, float) describing for each input float x,
        the output color in RGBA format;
        Each output value being between 0 and 1.
        """
        raise NotImplementedError

    def rgba_bytes_tuple(self, x):
        """Provides the color corresponding to value `x` in the
        form of a tuple (R,G,B,A) with int values between 0 and 255.
        """
        return tuple(int(u*255.9999) for u in self.rgba_floats_tuple(x))

    def rgb_bytes_tuple(self, x):
        """Provides the color corresponding to value `x` in the
        form of a tuple (R,G,B) with int values between 0 and 255.
        """
        return self.rgba_bytes_tuple(x)[:3]

    def rgb_hex_str(self, x):
        """Provides the color corresponding to value `x` in the
        form of a string of hexadecimal values "#RRGGBB".
        """
        return '#%02x%02x%02x' % self.rgb_bytes_tuple(x)

    def rgba_hex_str(self, x):
        """Provides the color corresponding to value `x` in the
        form of a string of hexadecimal values "#RRGGBBAA".
        """
        return '#%02x%02x%02x%02x' % self.rgba_bytes_tuple(x)

    def __call__(self, x):
        """Provides the color corresponding to value `x` in the
        form of a string of hexadecimal values "#RRGGBBAA".
        """
        return self.rgba_hex_str(x)

    def _repr_html_(self):
        return (
            '<svg height="50" width="500">' +
            ''.join(
                [('<line x1="{i}" y1="0" x2="{i}" '
                  'y2="20" style="stroke:{color};stroke-width:3;" />').format(
                      i=i*1,
                      color=self.rgba_hex_str(
                          self.vmin +
                          (self.vmax-self.vmin)*i/499.)
                  )
                 for i in range(500)]) +
            '<text x="0" y="35">{}</text>'.format(self.vmin) +
            '<text x="500" y="35" style="text-anchor:end;">{}</text>'.format(
                self.vmax) +
            '</svg>')


class LinearColormap(ColorMap):
    """Creates a ColorMap based on linear interpolation of a set of colors
    over a given index.
    Parameters
    ----------
    colors : list-like object with at least two colors.
        The set of colors to be used for interpolation.
        Colors can be provided in the form:
        * tuples of RGBA ints between 0 and 255 (e.g: `(255, 255, 0)` or
        `(255, 255, 0, 255)`)
        * tuples of RGBA floats between 0. and 1. (e.g: `(1.,1.,0.)` or
        `(1., 1., 0., 1.)`)
        * HTML-like string (e.g: `"#ffff00`)
        * a color name or shortcut (e.g: `"y"` or `"yellow"`)
    index : list of floats, default None
        The values corresponding to each color.
        It has to be sorted, and have the same length as `colors`.
        If None, a regular grid between `vmin` and `vmax` is created.
    vmin : float, default 0.
        The minimal value for the colormap.
        Values lower than `vmin` will be bound directly to `colors[0]`.
    vmax : float, default 1.
        The maximal value for the colormap.
        Values higher than `vmax` will be bound directly to `colors[-1]`.
    max_labels : int, default 10
        Maximum number of legend tick labels"""

    def __init__(self, colors, index=None, vmin=0., vmax=1., caption='', labels = None, max_labels=10):
        super(LinearColormap, self).__init__(vmin=vmin, vmax=vmax,
                                             caption=caption, max_labels=max_labels)

        n = len(colors)
        if n < 2:
            raise ValueError('You must provide at least 2 colors.')
        if index is None:
            self.index = [vmin + (vmax-vmin)*i*1./(n-1) for i in range(n)]
            self.labels = self.index
        else:
            self.index = list(index)
            self.labels = list(labels)
        self.colors = [_parse_color(x) for x in colors]

    def rgba_floats_tuple(self, x):
        """Provides the color corresponding to value `x` in the
        form of a tuple (R,G,B,A) with float values between 0. and 1.
        """
        if x <= self.index[0]:
            return self.colors[0]
        if x >= self.index[-1]:
            return self.colors[-1]

        i = len([u for u in self.index if u < x])  # 0 < i < n.
        if self.index[i-1] < self.index[i]:
            p = (x - self.index[i-1])*1./(self.index[i]-self.index[i-1])
        elif self.index[i-1] == self.index[i]:
            p = 1.
        else:
            raise ValueError('Thresholds are not sorted.')

        return tuple((1.-p) * self.colors[i-1][j] + p*self.colors[i][j] for j
                     in range(4))

    def to_step(self, n=None, index=None, data=None, method=None,
                quantiles=None, round_method=None, max_labels=10):
        """Splits the LinearColormap into a StepColormap.
        Parameters
        ----------
        n : int, default None
            The number of expected colors in the ouput StepColormap.
            This will be ignored if `index` is provided.
        index : list of floats, default None
            The values corresponding to each color bounds.
            It has to be sorted.
            If None, a regular grid between `vmin` and `vmax` is created.
        data : list of floats, default None
            A sample of data to adapt the color map to.
        method : str, default 'linear'
            The method used to create data-based colormap.
            It can be 'linear' for linear scale, 'log' for logarithmic,
            or 'quant' for data's quantile-based scale.
        quantiles : list of floats, default None
            Alternatively, you can provide explicitely the quantiles you
            want to use in the scale.
        round_method : str, default None
            The method used to round thresholds.
            * If 'int', all values will be rounded to the nearest integer.
            * If 'log10', all values will be rounded to the nearest
            order-of-magnitude integer. For example, 2100 is rounded to
            2000, 2790 to 3000.
        max_labels : int, default 10
            Maximum number of legend tick labels
        Returns
        -------
        A StepColormap with `n=len(index)-1` colors.
        Examples:
        >> lc.to_step(n=12)
        >> lc.to_step(index=[0, 2, 4, 6, 8, 10])
        >> lc.to_step(data=some_list, n=12)
        >> lc.to_step(data=some_list, n=12, method='linear')
        >> lc.to_step(data=some_list, n=12, method='log')
        >> lc.to_step(data=some_list, n=12, method='quantiles')
        >> lc.to_step(data=some_list, quantiles=[0, 0.3, 0.7, 1])
        >> lc.to_step(data=some_list, quantiles=[0, 0.3, 0.7, 1],
        ...           round_method='log10')
        """
        msg = 'You must specify either `index` or `n`'
        if index is None:
            if data is None:
                if n is None:
                    raise ValueError(msg)
                else:
                    index = [self.vmin + (self.vmax-self.vmin)*i*1./n for
                             i in range(1+n)]
                    scaled_cm = self
            else:
                max_ = max(data)
                min_ = min(data)
                scaled_cm = self.scale(vmin=min_, vmax=max_)
                method = ('quantiles' if quantiles is not None
                          else method if method is not None
                          else 'linear'
                          )
                if method.lower().startswith('lin'):
                    if n is None:
                        raise ValueError(msg)
                    index = [min_ + i*(max_-min_)*1./n for i in range(1+n)]
                elif method.lower().startswith('log'):
                    if n is None:
                        raise ValueError(msg)
                    if min_ <= 0:
                        msg = ('Log-scale works only with strictly '
                               'positive values.')
                        raise ValueError(msg)
                    index = [math.exp(
                        math.log(min_) + i * (math.log(max_) -
                                              math.log(min_)) * 1./n
                    ) for i in range(1+n)]
                elif method.lower().startswith('quant'):
                    if quantiles is None:
                        if n is None:
                            msg = ('You must specify either `index`, `n` or'
                                   '`quantiles`.')
                            raise ValueError(msg)
                        else:
                            quantiles = [i*1./n for i in range(1+n)]
                    p = len(data)-1
                    s = sorted(data)
                    index = [s[int(q*p)] * (1.-(q*p) % 1) +
                             s[min(int(q*p) + 1, p)] * ((q*p) % 1) for
                             q in quantiles]
                else:
                    raise ValueError('Unknown method {}'.format(method))
        else:
            scaled_cm = self.scale(vmin=min(index), vmax=max(index))

        n = len(index)-1

        if round_method == 'int':
            index = [round(x) for x in index]

        if round_method == 'log10':
            index = [_base(x) for x in index]

        colors = [scaled_cm.rgba_floats_tuple(index[i] * (1.-i/(n-1.)) +
                                              index[i+1] * i/(n-1.)) for
                  i in range(n)]

        caption = self.caption

        return StepColormap(colors, index=index, vmin=index[0], vmax=index[-1], caption=caption,
                            max_labels=max_labels)

    def scale(self, vmin=0., vmax=1., max_labels=10):
        """Transforms the colorscale so that the minimal and maximal values
        fit the given parameters.
        """
        return LinearColormap(
            self.colors,
            index=[vmin + (vmax-vmin)*(x-self.vmin)*1./(self.vmax-self.vmin) for x in self.index],  # noqa
            vmin=vmin,
            vmax=vmax,
            caption=self.caption,
            max_labels=max_labels
            )


class StepColormap(ColorMap):
    """Creates a ColorMap based on linear interpolation of a set of colors
    over a given index.
    Parameters
    ----------
    colors : list-like object
        The set of colors to be used for interpolation.
        Colors can be provided in the form:
        * tuples of int between 0 and 255 (e.g: `(255,255,0)` or
        `(255, 255, 0, 255)`)
        * tuples of floats between 0. and 1. (e.g: `(1.,1.,0.)` or
        `(1., 1., 0., 1.)`)
        * HTML-like string (e.g: `"#ffff00`)
        * a color name or shortcut (e.g: `"y"` or `"yellow"`)
    index : list of floats, default None
        The values corresponding to each color.
        It has to be sorted, and have the same length as `colors`.
        If None, a regular grid between `vmin` and `vmax` is created.
    vmin : float, default 0.
        The minimal value for the colormap.
        Values lower than `vmin` will be bound directly to `colors[0]`.
    vmax : float, default 1.
        The maximal value for the colormap.
        Values higher than `vmax` will be bound directly to `colors[-1]`.
    max_labels : int, default 10
        Maximum number of legend tick labels
    """
    def __init__(self, colors, index=None, vmin=0., vmax=1., caption='', max_labels=10):
        super(StepColormap, self).__init__(vmin=vmin, vmax=vmax,
                                           caption=caption, max_labels=max_labels)

        n = len(colors)
        if n < 1:
            raise ValueError('You must provide at least 1 colors.')
        if index is None:
            self.index = [vmin + (vmax-vmin)*i*1./n for i in range(n+1)]
        else:
            self.index = list(index)
        self.colors = [_parse_color(x) for x in colors]

    def rgba_floats_tuple(self, x):
        """
        Provides the color corresponding to value `x` in the
        form of a tuple (R,G,B,A) with float values between 0. and 1.
        """
        if x <= self.index[0]:
            return self.colors[0]
        if x >= self.index[-1]:
            return self.colors[-1]

        i = len([u for u in self.index if u < x])  # 0 < i < n.
        return tuple(self.colors[i-1])

    def to_linear(self, index=None, max_labels=10):
        """
        Transforms the StepColormap into a LinearColormap.
        Parameters
        ----------
        index : list of floats, default None
                The values corresponding to each color in the output colormap.
                It has to be sorted.
                If None, a regular grid between `vmin` and `vmax` is created.
        max_labels : int, default 10
            Maximum number of legend tick labels
        """
        if index is None:
            n = len(self.index)-1
            index = [self.index[i]*(1.-i/(n-1.))+self.index[i+1]*i/(n-1.) for
                     i in range(n)]

        colors = [self.rgba_floats_tuple(x) for x in index]
        return LinearColormap(colors, index=index,
                              vmin=self.vmin, vmax=self.vmax, max_labels=max_labels)

    def scale(self, vmin=0., vmax=1., max_labels=10):
        """Transforms the colorscale so that the minimal and maximal values
        fit the given parameters.
        """
        return StepColormap(
            self.colors,
            index=[vmin + (vmax-vmin)*(x-self.vmin)*1./(self.vmax-self.vmin) for x in self.index],  # noqa
            vmin=vmin,
            vmax=vmax,
            caption=self.caption,
            max_labels=max_labels
            )


class _LinearColormaps(object):
    """A class for hosting the list of built-in linear colormaps."""
    def __init__(self):
        self._schemes = _schemes.copy()
        self._colormaps = {key: LinearColormap(val) for
                           key, val in _schemes.items()}
        for key, val in _schemes.items():
            setattr(self, key, LinearColormap(val))

    def _repr_html_(self):
        return Template("""
        <table>
        {% for key,val in this._colormaps.items() %}
        <tr><td>{{key}}</td><td>{{val._repr_html_()}}</td></tr>
        {% endfor %}</table>
        """).render(this=self)


linear = _LinearColormaps()


class _StepColormaps(object):
    """A class for hosting the list of built-in step colormaps."""
    def __init__(self):
        self._schemes = _schemes.copy()
        self._colormaps = {key: StepColormap(val) for
                           key, val in _schemes.items()}
        for key, val in _schemes.items():
            setattr(self, key, StepColormap(val))

    def _repr_html_(self):
        return Template("""
        <table>
        {% for key,val in this._colormaps.items() %}
        <tr><td>{{key}}</td><td>{{val._repr_html_()}}</td></tr>
        {% endfor %}</table>
        """).render(this=self)


step = _StepColormaps()
