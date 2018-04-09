import React from 'react';
import { View, Animated, StyleSheet } from 'react-native';

import { mergeStyles } from '../Utils/mergeStyles';

/*
  This HOC wrapper creates animatable wrappers around the provided component
  to make it animatable - independent of wether it is a stateless or class
  component.

  In addition it wraps the element in two outer animatable components - one
  for transform animations that can be used with the native driver, and one
  for other properties that can be animated using a non-native animation driver.

  Example component:

  <View style={{ backgroundColor: #F00, transform: [{ rotate: '90deg' }] }}>
    <Text>Hello World</Text>
  </View>

  Results in the following component hierarchy where
  the outer views are animatable views:

  <View style={{ transform: [{ rotate: '90deg' }] }}>  <-- Native Animated Component
    <View style={{ backgroundColor: #F00, flex: 1 }} > <-- Animated Component
      <View style={flex: 1}>                           <-- Org. component
        <Text>Hello World</Text>
      </View>
    </View>
  </View>

  Parameters:
  component:    The component to create wrapper for. Can be a regular class based or
                stateless component.
  nativeStyles: Styles for the native part of the wrapper. Put any native animations
                (transforms & opacity) here. (optional)
  styles:       Styles for the non-native animations (optional)
  nativeCached: Provide a cached AnimatedComponent wrapper for the native part (optional)
  cached:       Provide a cached AnimatedComponent wrapper for the non-native part (optional)
  log:          Writes to debug output if true.
  logPrefix:    Prefix for the log output
*/
const createAnimatedWrapper = (
  component: any,
  nativeStyles: ?StyleSheet.NamedStyles,
  styles: ?StyleSheet.NamedStyles,
  nativeCached: ?any,
  cached: any,
  log: ?Boolean,
  logPrefix: ?String
) => {
  // Create wrapped views
  const nativeAnimatedComponent = nativeCached || createAnimated();
  const animatedComponent = cached || createAnimated();

  // Flatten style
  const flattenedStyle = StyleSheet.flatten(component.props.style);

  // Get styles
  const nativeAnimatedStyles = getNativeAnimatableStyles(flattenedStyle);
  const animatedStyles = getAnimatableStyles(flattenedStyle);
  const componentStyles = getComponentStyles(flattenedStyle);

  // create inner element
  const innerElement = React.createElement(component.type, {
    ...component.props,
    style: [componentStyles, getDebugBorder('#FF0')],
  });

  // Check if we have an absolute positioned element
  const additionalAnimatedStyles = { overflow: 'hidden' };

  // For absolute positioned elements we need to set the flex property
  // to enable full fill of the inner element.
  if (nativeAnimatedStyles && nativeAnimatedStyles.position === 'absolute') {
    additionalAnimatedStyles.flex = 1;
  }

  // Create Animated element
  const finalAnimatedStyles = [
    animatedStyles, 
    styles, 
    additionalAnimatedStyles, 
    getDebugBorder('#0F0')
  ];

  const animatedElement = React.createElement(
    animatedComponent, { style: finalAnimatedStyles },
    innerElement,
  );

  // Setup props for the outer wrapper (and native animated component)
  const finalNativeAnimatedStyles = [
    ...getStylesWithMergedTransforms([...nativeStyles, nativeAnimatedStyles]), 
    getDebugBorder('#00F')
  ];

  let props = {
    collapsable: false, // Used to fix measure on Android
    style: finalNativeAnimatedStyles,
  };

  // Copy some key properties
  if (component.key) { props = { ...props, key: component.key }; }
  if (component.ref) { props = { ...props, ref: component.ref }; }
  if (component.onLayout) { props = { ...props, onLayout: component.onLayout }; }

  // Create native animated component
  const nativeAnimatedElement = React.createElement(
    nativeAnimatedComponent,
    props, animatedElement,
  );

  if(log) {
    const log = (logPrefix ? logPrefix + "\n" : "") + 
                "  originalStyles:        " + JSON.stringify(StyleSheet.flatten(component.props.style)) + "\n" + 
                "  componentStyles:       " + JSON.stringify(componentStyles) + "\n" + 
                "  animatedStyles:        " + JSON.stringify(finalAnimatedStyles) + "\n" + 
                "  nativeAnimatedStyles:  " + JSON.stringify(finalNativeAnimatedStyles);
                
    console.log(log);
  }

  return nativeAnimatedElement;
};

const createAnimated = () => {
  // Create wrapped view
  const wrapper = (<View />);
  return Animated.createAnimatedComponent(wrapper.type);
};

const getDebugBorder = (color: string) => ({ borderWidth: 1, borderColor: color});

const getStylesWithMergedTransforms = (styles: Array<StyleSheet.NamedStyles>): Array<StyleSheet.NamedStyles> => {  
  const retVal = [];
  const transforms = [];
  if(styles){
    styles.forEach(s => {
      if(s) {
        if(s.transform) {
          const t = s.transform;
          delete s.transform;
          t.forEach(ti => {
            if(!transforms.find(el => Object.keys(el)[0] === Object.keys(ti)[0]))
              transforms.push(ti);
          });
        } 
        retVal.push(s);
      }
    })
    retVal.push({ transform: transforms });
    return retVal;
  }
  
  return styles;
}

const getNativeAnimatableStyles = (styles: Array<StyleSheet.NamedStyles>|StyleSheet.NamedStyles) =>
  getFilteredStyle(styles, (key) => includePropsForNativeStyles.indexOf(key) > -1);

const getAnimatableStyles = (styles: Array<StyleSheet.NamedStyles>|StyleSheet.NamedStyles) =>
  getFilteredStyle(styles, (key) => excludePropsForStyles.indexOf(key) === -1);

const getComponentStyles = (styles: Array<StyleSheet.NamedStyles>|StyleSheet.NamedStyles) =>
  getFilteredStyle(styles, (key) => excludePropsForComponent.indexOf(key) === -1);

const getFilteredStyle = (
  styles: Array<StyleSheet.NamedStyles>|StyleSheet.NamedStyles,
  shouldIncludeKey: (key: String) => void,
) => {
  if (!styles) return styles;
  let flattenedStyle = styles;
  if (!(styles instanceof Object)) {
    flattenedStyle = StyleSheet.flatten(styles);
  }

  if (!flattenedStyle) return styles;
  if (!(flattenedStyle instanceof Array)) {
    flattenedStyle = [flattenedStyle];
  }

  const retVal = {};
  flattenedStyle.forEach(s => {
    if (s) {
      const keys = Object.keys(s);
      keys.forEach(key => {
        if (!isNumber(key) && shouldIncludeKey(key)) {
          retVal[key] = s[key];
        }
      });
    }
  });

  return retVal;
};

function isNumber(n) { return !isNaN(parseFloat(n)) && !isNaN(n - 0); }

const excludePropsForComponent = [
  'display',
  // 'width',
  // 'height',
  'start',
  'end',
  'top',
  'left',
  'right',
  'bottom',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'margin',
  'marginVertical',
  'marginHorizontal',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginStart',
  'marginEnd',
  'padding',
  'paddingVertical',
  'paddingHorizontal',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingStart',
  'paddingEnd',
  'position',
  'flexWrap',
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'aspectRatio',
  'zIndex',
  'direction',
  'transform',
  'transformMatrix',
  'decomposedMatrix',
  'scaleX',
  'scaleY',
  'rotation',
  'translateX',
  'translateY',
  'backfaceVisibility',
  'backgroundColor',
  'borderColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderStartColor',
  'borderEndColor',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderTopStartRadius',
  'borderTopEndRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'borderBottomStartRadius',
  'borderBottomEndRadius',
  'borderStyle',
];

const includePropsForNativeStyles = [
  'display',
  'width',
  'height',
  'start',
  'end',
  'top',
  'left',
  'right',
  'bottom',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'margin',
  'marginVertical',
  'marginHorizontal',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginStart',
  'marginEnd',
  // "padding",
  // "paddingVertical",
  // "paddingHorizontal",
  // "paddingTop",
  // "paddingBottom",
  // "paddingLeft",
  // "paddingRight",
  // "paddingStart",
  // "paddingEnd",
  'position',
  'flexDirection',
  'flexWrap',
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'aspectRatio',
  'zIndex',
  'direction',
  'transform',
  // "transformMatrix",
  // "decomposedMatrix",
  // "scaleX",
  // "scaleY",
  // "rotation",
  // "translateX",
  // "translateY",
  // 'backfaceVisibility',
  // 'backgroundColor',
  // 'borderColor',
  // 'borderTopColor',
  // 'borderRightColor',
  // 'borderBottomColor',
  // 'borderLeftColor',
  // 'borderStartColor',
  // 'borderEndColor',
  // 'borderRadius',
  // 'borderTopLeftRadius',
  // 'borderTopRightRadius',
  // 'borderTopStartRadius',
  // 'borderTopEndRadius',
  // 'borderBottomLeftRadius',
  // 'borderBottomRightRadius',
  // 'borderBottomStartRadius',
  // 'borderBottomEndRadius',
  // 'borderStyle',
];

const excludePropsForStyles = [
  'display',
  // "width",
  // "height",
  'start',
  'end',
  'top',
  'left',
  'right',
  'bottom',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'margin',
  'marginVertical',
  'marginHorizontal',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginStart',
  'marginEnd',
  // "padding",
  // "paddingVertical",
  // "paddingHorizontal",
  // "paddingTop",
  // "paddingBottom",
  // "paddingLeft",
  // "paddingRight",
  // "paddingStart",
  // "paddingEnd",
  // "borderWidth",
  // "borderTopWidth",
  // "borderStartWidth",
  // "borderEndWidth",
  // "borderRightWidth",
  // "borderBottomWidth",
  // "borderLeftWidth",
  'position',
  // "flexDirection",
  // "flexWrap",
  // "justifyContent",
  // "alignItems",
  'alignSelf',
  'alignContent',
  'overflow',
  // "flex",
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'aspectRatio',
  'zIndex',
  'direction',
  // 'shadowColor',
  // 'shadowOffset',
  // 'shadowOpacity',
  // 'shadowRadius',
  // 'elevation',
  'transform',
  'transformMatrix',
  'decomposedMatrix',
  'scaleX',
  'scaleY',
  'rotation',
  'translateX',
  'translateY',
  // 'backfaceVisibility',
  // 'backgroundColor',
  // 'borderColor',
  // 'borderTopColor',
  // 'borderRightColor',
  // 'borderBottomColor',
  // 'borderLeftColor',
  // 'borderStartColor',
  // 'borderEndColor',
  // 'borderRadius',
  // 'borderTopLeftRadius',
  // 'borderTopRightRadius',
  // 'borderTopStartRadius',
  // 'borderTopEndRadius',
  // 'borderBottomLeftRadius',
  // 'borderBottomRightRadius',
  // 'borderBottomStartRadius',
  // 'borderBottomEndRadius',
  // 'borderStyle',
  // 'opacity',
  'textAlign',
];

export { createAnimatedWrapper, createAnimated };
